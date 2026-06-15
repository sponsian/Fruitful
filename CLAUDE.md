# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fruitful (fruitful.sponsian.org) — a suite of small crypto dapps (send, disperse, swap, revoke, multisafe, address-book, wallet) built with Next.js App Router, React 19, TypeScript, wagmi/viem, RainbowKit, and Tailwind CSS. Bun is the package manager (`bun.lockb`).

Fruitful is a fork of Smol (SmolDapp), rebranded and ported to the **Reef Pelagia testnet** (chain ID 13939, native REEF with 12 decimals, PolkaVM via `pallet-revive`). Ethereum mainnet is also kept (ENS/Clusters resolution; swap and multisafe only work there). Internal identifiers still use the Smol naming (`Smol*` components, `TSmol*` types, `SMOL_*` env vars) — only user-visible branding was renamed. See `docs/pelagia-port-plan.md` and `docs/pelagia-contract-deployment.md`.

## Commands

- `bun install` — install dependencies
- `bun run dev` — start Next.js dev server
- `bun run dev:ts` — TypeScript compiler in watch mode (run alongside dev)
- `bun run build` — production build (`next build --webpack`)
- `bun run lint` — ESLint over `.js,.jsx,.ts,.tsx`
- `bun run prettier-format` — format with Prettier
- `tsc --noEmit` — typecheck. **Important:** `next.config.js` sets `typescript.ignoreBuildErrors: true`, so the build will NOT catch type errors — run tsc explicitly.

There is no test suite.

Running the app locally requires RPC env vars (`RPC_URI_FOR_<chainId>`) and `WALLETCONNECT_PROJECT_ID`; see the `env` block in `next.config.js` for the full list. API routes use `TELEGRAM_BOT`/`TELEGRAM_CHAT` (notify/report endpoints) and degrade if unset.

## Architecture

Everything lives in `app/` (Next.js App Router):

- `app/(apps)/<name>/` — one folder per mini-app (send, disperse, swap, revoke, multisafe, address-book, wallet). Each is self-contained: `page.tsx`, `components/`, `contexts/` (the app's state provider, e.g. `useSend.tsx`, `useDisperse.tsx`, `useSwapFlow.lifi.tsx`), `types.ts`, and app-specific utils/actions. The swap app is powered by LiFi (`swap/utils/api.lifi.ts`).
- Shared code lives in underscore-prefixed dirs imported via the `@lib/*` path aliases (defined in `tsconfig.json`):
  - `@lib/utils/*` → `app/_utils/*` — chain config, address/erc20/transaction helpers, ABIs
  - `@lib/components/*` → `app/_components/*` — shared UI (Smol* inputs, curtains, modals)
  - `@lib/icons/*` → `app/_components/icons/*`
  - `@lib/contexts/*` → `app/_contexts/*` — global providers
  - `@lib/hooks/*` → `app/_hooks/*` — generic hooks plus `web3/` (ENS, Clusters, validation, Safe detection)
- `app/api/notify` and `app/api/report` — API routes that forward messages/screenshots to Telegram.

### Provider stack

`app/layout.tsx` hydrates wagmi state from cookies (SSR) and wraps everything in `app/Providers.tsx`:
`WithFonts → IndexedDB → WithMom → WalletContextApp → WithPopularTokens → WithPrices → SafeProvider → PlausibleProvider`

- `WithMom` (`app/_contexts/WithMom.tsx`) owns the wagmi/RainbowKit/react-query config and builds per-chain RPC transports (`withRPC`) from env vars with fallbacks. The wagmi `config` is exported from here.
- `useWallet` provides connected-account balances; `WithPrices` provides token prices; token lists come from SmolDapp/tokenLists.

### Chain configuration

`app/_utils/tools.chains.ts` is the single source of truth for supported networks (currently Ethereum mainnet + Reef Pelagia). `CHAINS` is a record keyed by chain id where each entry extends a viem `Chain` with app metadata (`isEnabledInProd`, `isLifiSwapSupported`, `isMultisafeSupported`, `safeAPIURI`, `disperseAddress`, etc.). It exports `networks` and `supportedNetworks`. Add/modify chain support here, plus the matching `RPC_URI_FOR_<id>` env entry in `next.config.js`. Testnet chains flagged `isEnabledInProd` (Reef Pelagia) are treated as user-facing networks; `useWallet` skips other testnets outside dev. The Pelagia entry's `disperseAddress`/`contracts.multicall3` are placeholders until the contracts are deployed (see `docs/pelagia-contract-deployment.md`); the disperse button stays disabled while `disperseAddress` is the zero address.

## Code style (enforced by ESLint/Prettier; lint-staged runs prettier + eslint --fix + tsc on commit)

- Tabs, single quotes, semicolons, 120-char lines, no trailing commas.
- Type aliases must be PascalCase prefixed with `T` (`TAddress`), interfaces with `I`; prefer `type` over `interface`.
- Boolean variables must be prefixed (`is`, `should`, `has`, `can`, ...).
- Explicit function return types are required (`ReactElement` for components).
- Type-only imports must use `import type`, and types go last in import order (builtin → external → internal → relative → types).
- JSX props and children require curly braces: `<Button label={'text'}>{'children'}</Button>`.
- `useAsyncTrigger` (in `@lib/hooks`) is checked by `react-hooks/exhaustive-deps` like a built-in hook.
