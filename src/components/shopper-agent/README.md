# Shopper Agent (Embedded Messaging)

Integrates **Salesforce Embedded Messaging** (Agentforce) so shoppers can open a chat window from the storefront. The agent chunk and embedded service script are deferred via `requestIdleCallback` so they do not block the main thread during hydration; if the user clicks **Open chat** before the first idle, the chunk loads on demand and the scheduled idle callback is cancelled.

## Configuration

Set one environment variable with the full config as a JSON string.

**Value:** Minified JSON object with keys: `enabled`, `embeddedServiceName`, `embeddedServiceEndpoint`, `scriptSourceUrl`, `scrt2Url`, `salesforceOrgId`, `siteId`, and optionally `enableConversationContext`, `conversationContext`. Build the JSON manually from the Embedded Service chat snippet; see documentation for the mapping and an example.

## Setup for different environments

1. **Local / .env**  
   Set `PUBLIC__app__commerceAgent` to the minified JSON string.

2. **Managed Runtime (MRT)**  
   In Environment Variables, add `PUBLIC__app__commerceAgent` and set its value to the minified JSON. Save; the project redeploys with the new config.

3. **Disable the agent**  
   Omit the variable or set `enabled` to `"false"` in the JSON.

## Usage

- **Root layout**  
  The app mounts `<ShopperAgent />` when `appConfig.commerceAgent?.enabled` is `'true'` or `true` (string or boolean). No extra wiring needed if config is set.

- **Open chat only**  
  `launchChat()` or `openShopperAgent()` from `@/components/shopper-agent`.

- **Open shopper agent and send an initial message**  
  `openShopperAgentAndSendMessage(text)` — launches the window and sends `text` (e.g. header search text or a PDP FAQ question), or queues it until Embedded Messaging fires `onEmbeddedMessagingFirstBotMessageSent`, then sends.

- **PDP “Ask assistant” FAQ**  
  When the shopper agent is enabled, config validates, and `isShopperAgentContextUiEnabled()` is true (see `src/lib/shopper-agent-context-ui.ts`), each FAQ question row opens the agent and sends that question as the first shopper message. Until product-context support is ready, `SHOPPER_AGENT_CONTEXT_UI_ENABLED` stays `false` so the FAQ block stays hidden while header/search assistant remain available. Storybook swaps that module for `.storybook/shims/shopper-agent-context-ui.ts` via a Vite alias so FAQ stories still render — see `.storybook/README-STORYBOOK.md`.

- **Account overview — Need Help**  
  The card (title, Contact info, Browse FAQ) always renders. **Ask a question** appears only when config validates **and** `isShopperAgentContextUiEnabled()` is true — same gate as PDP FAQ; it stays hidden when config is invalid or the constant is still `false`.

- **Accessibility**  
  Use an `aria-label` (e.g. “Open chat”) on controls that only open the widget. The header search card and PDP FAQ rows use translated labels where applicable.

## References

- [Embedded Messaging API](https://developer.salesforce.com/docs/service/messaging-web/guide/embedded-messaging-api.html)
- Config base: `config.server.ts` → `app.commerceAgent`
- Env convention: `docs/README-CONFIG.md`, `docs/README-CONFIG-OPTIONS.md`
