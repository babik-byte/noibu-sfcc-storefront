#!/usr/bin/env bash
# Ensure the active B2C code version contains the SFRA cartridges.
#
# Background: this instance hosts two sites — site4 (Storefront Next) and
# RefArch (SFRA). Publishing an SFNext bundle can create and activate a fresh
# code version containing only app_storefrontnext_base, which silently breaks
# the SFRA site ("Pipeline not found (Home)"). This script restores the SFRA
# cartridge set into the active code version whenever it is missing.
#
# Credentials: read by the b2c CLI from ./dw.json or SFCC_* env vars.
set -euo pipefail

REFERENCE_VERSION="${SFRA_REFERENCE_VERSION:-sfra_sfnext_combined_20260707}"
SFRA_CARTRIDGES=(app_storefront_base bm_app_storefront_base modules int_noibu int_noibu_sfra_changes int_noibu_sg_changes)

# In CI the b2c CLI (and SFCC credentials) are not available in the MRT deploy job,
# and the cartridge deploy job is already pinned to a fixed code version via the
# SFCC_CODE_VERSION variable, so the check is unnecessary there — skip gracefully.
if ! command -v b2c >/dev/null 2>&1; then
    echo "b2c CLI not available — skipping SFRA cartridge check."
    exit 0
fi

ACTIVE=$(b2c code list --json | python3 -c "
import json, sys
for v in json.load(sys.stdin)['data']:
    if v.get('active'):
        print(v['id'])
        break
")
[ -n "$ACTIVE" ] || { echo "ERROR: could not determine active code version" >&2; exit 1; }

HAS_SFRA=$(b2c code list --json | python3 -c "
import json, sys
for v in json.load(sys.stdin)['data']:
    if v.get('active'):
        print('yes' if 'app_storefront_base' in (v.get('cartridges') or []) else 'no')
        break
")

if [ "$HAS_SFRA" = "yes" ]; then
    echo "Active code version '$ACTIVE' already contains the SFRA cartridges — nothing to do."
    exit 0
fi

echo "Active code version '$ACTIVE' is missing the SFRA cartridges — restoring from '$REFERENCE_VERSION'..."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

b2c code download --code-version "$REFERENCE_VERSION" -o "$TMP/src"

DEPLOY="$TMP/deploy"
mkdir "$DEPLOY"
for c in "${SFRA_CARTRIDGES[@]}"; do
    if [ -d "$TMP/src/$c" ]; then
        cp -R "$TMP/src/$c" "$DEPLOY/"
    else
        echo "WARN: cartridge '$c' not found in $REFERENCE_VERSION — skipping" >&2
    fi
done

b2c code deploy "$DEPLOY" --code-version "$ACTIVE"
echo "SFRA cartridges restored into active code version '$ACTIVE'."
