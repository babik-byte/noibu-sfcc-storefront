# Authentication & Session Management

This project uses a split-cookie architecture for managing SLAS authentication tokens. The implementation separates auth concerns between server and client, with automatic token refresh and session management.

## Architecture Overview

We maintain **separate authentication contexts** for server and client, plus a React context for components:

1. **Server-side middleware** (`auth.server.ts`): Manages auth tokens, writes cookies via `Set-Cookie` headers
2. **Client-side middleware** (`auth.client.ts`): Reads auth cookies, maintains in-memory cache, initializes router context
3. **React Context + root provider** (`AuthContext` + `AuthProvider`): Components consume auth via a React context that is always provided by the root `App` component. During hydration, the root uses a `bootstrapAuth` value derived from cookies; after hydration, it uses loader-based session data.

### Server and Client Flow

1. **Server middleware** detects or creates user session with SLAS tokens
2. Server writes auth data to **separate cookies** via `Set-Cookie` headers
3. **Browser receives and stores** cookies automatically
4. **Cookies are written** with the latest tokens and user metadata
5. On the client, a **bootstrap auth snapshot** (`bootstrapAuth`) is derived from cookies once at module load time and used by the root `App` as a fallback during hydration
6. **Client middleware** initializes router context during execution and maintains in-memory cache for further use of authData
7. On subsequent client-side navigations, **client middleware** reads cookies and validates tokens; server is only involved on full page refreshes

## Cookie Architecture

### Split Cookie Design

Authentication data is stored in **separate cookies**, each with specific purpose and expiry:

| Cookie Name  | Purpose                                                                                        | User Type       | Expiry                | HttpOnly |
| ------------ | ---------------------------------------------------------------------------------------------- | --------------- | --------------------- | -------- |
| `cc-nx-g`    | Guest refresh token                                                                            | Guest only      | 30 days (max)         | No       |
| `cc-nx`      | Registered refresh token                                                                       | Registered only | 90 days (max)         | No       |
| `cc-at`      | Access token                                                                                   | Both            | 30 minutes            | No       |
| `usid`       | User session ID (mirrors the JWT `sub` claim's `usid` segment)                                 | Both            | Matches refresh token | No       |
| `idp_access_token` | IDP access token (social login)                                                          | Both            | Matches access token  | No       |
| `cc-cv`      | OAuth2 PKCE code verifier (Temporary cookie deleted after successful token call via PKCE flow) | Both            | 5 minutes             | **Yes**  |
| `cc-auth-recover` | Auth recovery guard (prevents redirect loops after 401)                                    | Both            | 30 seconds            | No       |

> **Note on `usid`:** sf-next reads `usid` from the access token JWT `sub` claim, **not** from
> this cookie. The cookie is kept so hybrid storefronts can forward `usid` to ECOM, which does
> not parse the access token. The cookie value also serves as a cold-start fallback for the
> guest-login path (passed to SLAS for session continuity when no access token is present).
>
> **Note on `customer_id`:** `customer_id` is **not** persisted as a cookie. It is derived
> per-request from the SLAS access token JWT `isb` claim (via `gcid`/`rcid`) and exposed to
> loaders/actions via `getAuth(context)` and to client components via `useAuth()`. The destroy
> path clears any `customer_id_<siteId>` cookie on logout/error so the value never lingers for
> a logged-out browser. Browsers upgraded from older versions may also retain a legacy
> `customerId_<siteId>` cookie; it is ignored and will expire on its own.

**Key Design Decisions:**

- **Mutually Exclusive Refresh Tokens**: Only ONE refresh token cookie exists at a time (`cc-nx-g` OR `cc-nx`, never both)
- **User Type Derivation**: `userType` is **NEVER stored in cookies**. It's derived at runtime from which refresh token cookie exists
- **Cookie Namespacing**: All cookies are automatically namespaced with `siteId` (e.g., `cc-nx_RefArch`)
- **HttpOnly Exception**: Only `cc-cv` (code verifier) uses `httpOnly: true` for security; others use `httpOnly: false` to allow client-side JavaScript to read auth data from cookies (required for AuthContext default value and client middleware).
- **Browser Auto-Cleanup**: Cookies include expiry dates, so browser automatically deletes expired cookies. Cookies are also deleted on shopper logout.

### User Type Detection

User type is determined by which refresh token cookie exists:

```typescript
// Server-side (auth.server.ts)
if (refreshTokenRegistered) {
    userType = 'registered';
    refreshToken = refreshTokenRegistered;
} else if (refreshTokenGuest) {
    userType = 'guest';
    refreshToken = refreshTokenGuest;
} else {
    userType = 'guest'; // Fallback - will trigger guest login
    refreshToken = null;
}
```

On user type transition (e.g., guest → registered), the old refresh token cookie is explicitly deleted by the server.(`Set-Cookie: cc-nx-g=""`)

### Token Expiry Management

**Access Token Expiry:**

- Extracted directly from JWT `exp` claim (source of truth)
- Decoded **once** during middleware initialization
- Fast numeric comparison at runtime: `accessTokenExpiry > Date.now()`
- No repeated JWT decoding needed

**Refresh Token Expiry:**

- Configurable via environment variables (with B2C Commerce maximum limits enforced)
- Guest tokens: 30 days maximum
- Registered tokens: 90 days maximum

### 401 Recovery Redirect (Server)

If a SCAPI call returns **401** for non-SLAS endpoints, the SCAPI client throws an `AuthTokenInvalidError`. The server auth middleware catches this error, clears the in-memory access token, re-runs the refresh/guest flow, and issues a **307 redirect** back to the same URL to restart the request lifecycle with fresh tokens.

To prevent infinite loops, the middleware sets a short-lived guard cookie:

- `cc-auth-recover`: boolean guard set during recovery redirect
- If another 401 occurs while this cookie is present, the error is allowed to surface and no additional redirect happens
- The guard cookie is cleared on the subsequent request

The recovery redirect response also includes `x-sfnext-auth-recovery: 1`. When the guard cookie is present on a follow-up request, responses include `x-sfnext-auth-recovery-guard: 1` for log visibility.

Before running the recovery flow, any stale `error` state from earlier middleware auth attempts is cleared to avoid false negatives.

### JWT integrity validation

The auth middleware also validates the SLAS access token's structure on every request. SLAS
guarantees the following claims:

- `isb`: contains `gcid:<id>` (guest) and/or `rcid:<id>` (registered) for the customer ID
- `sub`: contains `usid:<id>` for the SLAS session ID

If the JWT decodes successfully but is missing either claim, the middleware throws
`AuthTokenInvalidError`, which routes through the same recovery flow as a 401: cookies are
cleared, a fresh refresh / guest login runs, and a 307 redirect is emitted. The same recovery
applies if SLAS itself returns a structurally invalid token during a refresh or guest login —
the middleware detects the `AuthTokenInvalidError` thrown by `updateAuthStorageDataByTokenResponse`
and writes the recovery sentinel into auth storage so the post-handler check picks it up.

Reaching this path indicates a critical token-integrity failure (e.g. a bug in token issuance)
rather than a normal auth lifecycle event. The defensive log fires at error level so the case
is observable in production.

## Configuration

### Environment Variables (Optional)

Configure refresh token expiry and cookie settings in your `.env` file:

```bash
# Optional: Override guest refresh token expiry (max 30 days)
PUBLIC_COMMERCE_API_GUEST_REFRESH_TOKEN_EXPIRY_SECONDS=2592000

# Optional: Override registered refresh token expiry (max 90 days)
PUBLIC_COMMERCE_API_REGISTERED_REFRESH_TOKEN_EXPIRY_SECONDS=7776000

# Optional: Set cookie domain for cross-subdomain sharing
PUBLIC_COOKIE_DOMAIN=.yourstore.com
```

### Cookie Configuration

Cookie settings are managed via `getCookieConfig()` with precedence:

1. **Environment variables** (highest priority)
2. **Provided options** (function arguments)
3. **Default values** (path, sameSite, secure)

```typescript
import { getCookieConfig } from '@/lib/cookie-utils';

// Uses environment config + defaults
const config = getCookieConfig({ httpOnly: false }, context);
```

## Usage Examples

### Accessing Auth Data on Server

Use the `getAuth()` helper in loaders and actions:

```typescript
import { getAuth } from '@/middlewares/auth.server';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ context }: LoaderFunctionArgs) {
    const auth = getAuth(context);

    // Access auth properties
    const accessToken = auth.access_token;
    const customerId = auth.customer_id;
    const userType = auth.userType; // 'guest' | 'registered'
    const usid = auth.usid;

    // Check if user is authenticated
    const isGuest = auth.userType === 'guest';
    const isRegistered = auth.userType === 'registered';

    return { customerId, isRegistered };
}
```

### Accessing Auth Data on Client

Use the same `getAuth()` helper in client loaders:

```typescript
import { getAuth } from '@/middlewares/auth.client';
import type { ClientLoaderFunctionArgs } from 'react-router';

export async function clientLoader({ context }: ClientLoaderFunctionArgs) {
    const auth = getAuth(context);

    // Same API as server-side
    const accessToken = auth.access_token;
    const isRegistered = auth.userType === 'registered';

    return { isRegistered };
}
```

### Updating Auth (Login)

Use `updateAuth()` to update auth state after login:

```typescript
import { updateAuth } from '@/middlewares/auth.server';
import { loginRegisteredUser } from '@/middlewares/auth.server';
import type { ActionFunctionArgs } from 'react-router';

export async function action({ request, context }: ActionFunctionArgs) {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
        // Call SLAS login endpoint
        const tokenResponse = await loginRegisteredUser(context, email, password);

        // Update auth storage and cookies
        updateAuth(context, tokenResponse);

        return redirect('/account');
    } catch (error) {
        return { error: 'Login failed' };
    }
}
```

### Destroying Auth (Logout)

Use `destroyAuth()` to clear all auth cookies:

```typescript
import { destroyAuth } from '@/middlewares/auth.server';
import type { ActionFunctionArgs } from 'react-router';

export async function action({ context }: ActionFunctionArgs) {
    // Clear all auth cookies and storage
    destroyAuth(context);

    return redirect('/');
}
```

### Social Login (OAuth2 PKCE Flow)

The auth system supports OAuth2 PKCE flow for social login providers (Google, Facebook, etc.):

```typescript
import { generateCodeVerifier, generateCodeChallenge } from '@/utils/pkce';
import { updateAuth } from '@/middlewares/auth.server';

// Step 1: Generate PKCE challenge and redirect to IDP
export async function loader({ context }: LoaderFunctionArgs) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code verifier in httpOnly cookie (server-only, 5 min expiry)
    const auth = getAuth(context);
    updateAuth(context, (data) => ({
        ...data,
        codeVerifier, // Automatically stored in cc-cv cookie
    }));

    // Redirect to IDP with code challenge
    const authUrl = `${idpUrl}?code_challenge=${codeChallenge}`;
    return redirect(authUrl);
}

// Step 2: Handle OAuth callback
export async function callbackAction({ request, context }: ActionFunctionArgs) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    // Retrieve code verifier from cookie
    const auth = getAuth(context);
    const codeVerifier = auth.codeVerifier;

    // Exchange code for tokens (using codeVerifier for PKCE verification)
    const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);

    // Update auth with new tokens (code verifier cookie is auto-deleted)
    updateAuth(context, tokenResponse);

    return redirect('/account');
}
```

> **CSP note:** When you add a social-login provider beyond the defaults, extend `connect-src` (and any redirect/popup origins) in your `app.security.headers.csp.directives` config. See [README-SECURITY-HEADERS.md](./README-SECURITY-HEADERS.md).

### Custom Auth Operations

For custom auth workflows, use the provided server-side helpers:

```typescript
import {
    loginGuestUser,
    loginRegisteredUser,
    refreshAccessToken,
    authorizePasswordless,
    getPasswordLessAccessToken,
    getPasswordResetToken,
    resetPasswordWithToken,
} from '@/middlewares/auth.server';

// Guest login
const guestTokens = await loginGuestUser(context, { usid: 'optional-usid' });

// Refresh access token
const newTokens = await refreshAccessToken(context, refreshToken);

// Passwordless login (magic link)
await authorizePasswordless(context, {
    userid: 'user@example.com',
    redirectPath: '/account',
});

// Get token from magic link
const tokens = await getPasswordLessAccessToken(context, magicLinkToken);

// Password reset flow
await getPasswordResetToken(context, { email: 'user@example.com' });
await resetPasswordWithToken(context, {
    email: 'user@example.com',
    token: 'reset-token',
    newPassword: 'newPassword123',
});
```

## Authentication Flows

### New Guest User

1. User visits site without cookies
2. Server middleware detects no auth cookies
3. Server calls SLAS guest login endpoint
4. Server writes `cc-nx-g`, `cc-at`, `usid` cookies via `Set-Cookie`
5. Browser stores cookies and renders page
6. On client hydration, `AuthContext` default value reads cookies at module load time
7. Client middleware reads cookies into in-memory cache and initializes router context

### Returning User (Token Valid)

1. User visits site with valid cookies
2. Server middleware reads cookies from `Cookie` header
3. Server validates access token expiry (fast JWT check)
4. If valid, server proceeds with existing tokens
5. If access token expired but refresh token valid, server refreshes
6. Updated tokens written back via `Set-Cookie` headers

### Guest → Registered User (Login)

1. Guest user submits login form
2. Server action calls `loginRegisteredUser()`
3. SLAS returns registered user tokens with `customer_id`
4. Server calls `updateAuth()` with token response
5. Server middleware writes `cc-nx`, `cc-at`, `usid` cookies
6. Server middleware **deletes** old `cc-nx-g` cookie (mutual exclusivity)
7. On next request, server detects `cc-nx` cookie → `userType = 'registered'`

### User Logout

1. User clicks logout button
2. Server action calls `destroyAuth(context)`
3. Server middleware deletes all auth cookies via `Set-Cookie` with `expires=Thu, 01 Jan 1970`
4. Browser receives response and deletes cookies
5. On next request, server detects no cookies → new guest login

### External Token Updates (Hybrid Storefronts)

1. External system (e.g., ECOM cartridge) updates auth cookies
2. User navigates to new page in React app
3. **Full page load**: Server middleware reads updated cookies from `Cookie` header and validates tokens
4. **Client-side navigation**: Client middleware reads updated cookies from `document.cookie` and syncs in-memory cache
5. AuthProvider in `root.tsx` updates React Context with latest auth state
6. App reflects new auth state automatically

## Token Validation Flow

The server and client use the same validation logic:

```
1. Check if access token exists and not expired (JWT exp claim)
   ✅ If valid → use it
   ❌ If expired → proceed to step 2

2. Check if refresh token exists
   ✅ If exists → call refresh endpoint for new access token
   ❌ If missing → proceed to step 3

3. Fallback to guest login
   → Get new guest tokens
   → Write cookies
```

## Hydration Strategy

To prevent React hydration mismatches while keeping auth tokens out of serialized loader data, auth is made available **immediately** during hydration via a combination of:

- A **bootstrap snapshot** of auth data derived from cookies on the client (`bootstrapAuth`)
- A **root-level `AuthProvider`** that always wraps the app and chooses between loader-based session data and `bootstrapAuth`

```typescript
// providers/auth.tsx
export const bootstrapAuth: SessionData | undefined =
    typeof window === 'undefined'
        ? undefined
        : (getAuthDataFromCookies() as SessionData | undefined);

export const AuthContext = createContext<SessionData | undefined>(undefined);
```

```typescript
// root.tsx (simplified)
import AuthProvider, { bootstrapAuth } from '@/providers/auth';

export default function App({ loaderData: { auth, /* ... */ } }: { loaderData: LoaderData }) {
    const loaderSession = auth?.();
    const sessionData = loaderSession ?? bootstrapAuth;

    const providers = useMemo(
        () =>
            [
                [AuthProvider, { value: sessionData }],
                // other providers...
            ] as const,
        [sessionData]
    );

    return <ComposeProviders providers={providers}>{/* app */}</ComposeProviders>;
}
```

### How It Works

- On the **server**:
  - Middleware builds a `SessionData` object.
  - The root loader returns `auth: () => session` to avoid serializing `SessionData` into the HTML/data payload.
  - `bootstrapAuth` is always `undefined` on the server.
- On the **client during initial hydration**:
  - `bootstrapAuth` is computed once from cookies at module load time.
  - Before `clientLoader` runs, `auth?.()` returns `undefined`, so `sessionData = bootstrapAuth`.
  - The root always renders `<AuthProvider value={sessionData}>`, so components using `useAuth()` see cookie-derived auth that matches the SSR markup.
- **After `clientLoader` and on subsequent navigations**:
  - The client loader recomputes auth from the middleware/client context.
  - `auth?.()` now returns live `SessionData`, so `sessionData = loaderSession`.
  - `AuthProvider` stays mounted; only its `value` changes, and `useAuth()` consumers re-render with the updated auth.

This keeps:

- A **single source of truth** for live auth state in the middleware/client loader pipeline
- **Cookie-based bootstrap** only for the hydration gap
- A **stable provider tree** (no conditional `AuthProvider` mounting/unmounting)
- **No token serialization** into loader JSON or HTML

## Best Practices

1. **Server vs Client**: Use `getAuth()` in loaders/actions; same API works in both environments
2. **Cookie Management**: Never write cookies directly; use `updateAuth()` or `destroyAuth()`
3. **User Type Checks**: Always use `auth.userType` to determine guest vs registered
4. **Token Refresh**: Middleware handles automatic refresh; no manual intervention needed
5. **Security**: Never log or expose `access_token` or `refresh_token` values
6. **PKCE Flow**: Always use `httpOnly: true` for `code_verifier` in OAuth2 flows
7. **Error Handling**: Check for `auth.error` property to detect auth failures

## Type Safety

The project includes TypeScript types for all auth operations:

```typescript
import type { AuthData, AuthStorageData } from '@/middlewares/auth.utils';

// AuthData includes:
interface AuthData {
    accessToken?: string;
    accessTokenExpiry?: number;
    usid?: string;
    refreshToken?: string;
    refreshTokenExpiry?: number;
    idpAccessToken?: string;
    customerId?: string;
    userType?: 'guest' | 'registered';
    codeVerifier?: string;
}
```

## File Structure

```
src/
├── middlewares/
│   ├── auth.server.ts       # Server auth middleware & SLAS operations
│   ├── auth.client.ts       # Client auth middleware, token sync & router context init
│   └── auth.utils.ts        # Shared auth utilities & cookie names
├── providers/
│   └── auth.tsx             # AuthContext + AuthProvider with bootstrapAuth used at the root for hydration
└── lib/
    ├── cookies.server.ts    # Server cookie utilities (Node.js)
    ├── cookies.client.ts    # Client cookie utilities (browser)
    └── cookie-utils.ts      # Shared cookie config & namespacing
```