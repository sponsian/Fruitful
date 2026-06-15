# Plan: Rename Smol → Fruitful and port to Reef Pelagia testnet

This document plans the work to rebrand the Smol dapp suite as **Fruitful** and make it run on **Reef Pelagia**, Reef's next-generation testnet. The companion document [pelagia-contract-deployment.md](./pelagia-contract-deployment.md) is the hand-off guide for whoever deploys the required contracts.

## Reef Pelagia: facts that drive this plan

From the Reef docs (docs.reef.io, retrieved 2026-06-12):

| Parameter | Value |
| --- | --- |
| Network name | Reef Pelagia |
| EVM chain ID | **13939** (note: legacy Reef mainnet/testnet share this ID) |
| Native token | REEF, **12 decimals** (legacy Reef networks used 18) |
| HTTP RPC | `https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/` |
| Block explorer | Blockscout at `https://explorer-frontend-ibcy8d-1204c4-72-60-35-83.nip.io/` |
| Faucet | `https://faucet.reef-node-reefdevcluster-6058af-72-60-35-83.nip.io/` (2,000 REEF per drip) |
| Block time | 10s (BABE authoring, GRANDPA finality) |
| VM | **PolkaVM via `pallet-revive`** — not `pallet-evm` |
| Native REEF precompile | `0x0000000000000000000000000000000001000000` |
| Contract code limit | 100 KB blob (vs Ethereum's 24 KB) |

Consequences that matter for this codebase:

- **Contracts must be compiled with `resolc` (Solidity ≥ 0.8.0), not standard `solc`.** No canonical Ethereum contract (Multicall3, Disperse, Safe) exists at its usual address, and deterministic/CREATE2 deployments won't reproduce canonical addresses. Everything we rely on must be deployed fresh and the addresses recorded in our chain config.
- **viem and ethers v6 are confirmed compatible**, so the wagmi/viem stack survives the port. Hardhat works via `@parity/hardhat-polkadot` v0.1.9; Foundry support is still under evaluation.
- **12-decimal native currency.** Most of the codebase normalizes by `token.decimals` dynamically, but anything assuming 18 for the gas token must be audited.
- **Testnet state may be reset on upgrades** — deployments must be reproducible and the addresses easy to swap.
- The RPC/explorer/faucet hostnames are auto-generated `nip.io` cluster names and differ slightly between doc pages — treat them as unstable and always inject the RPC via env (`RPC_URI_FOR_13939`), never rely on the hardcoded default alone.

---

## Phase 1 — Rename Smol → Fruitful

There are ~167 case-insensitive "smol" occurrences across 63 files in `app/`, plus config and assets. Split into user-visible (must change) and internal (mechanical, optional second pass).

### 1a. Config and metadata (user-visible)

- `package.json` — `"name": "smol"` → `"fruitful"`.
- `next.config.js`:
  - `PROJECT_SLUG: 'smoldapp'` → `'fruitful'`.
  - `WALLETCONNECT_PROJECT_NAME: 'Smol'` → `'Fruitful'`, plus `_DESCRIPTION`, `_URL`, `_ICON` (new domain + icon).
  - `PLAUSIBLE_DOMAIN: 'smold.app'` and the `withPlausibleProxy` `customDomain` → Fruitful domain (or remove analytics until a domain exists).
  - The host-based redirects (`multisafe.app`, `migratooor.com`, `disperse.smold.app`, …) are Smol-legacy — drop them.
  - Decide whether to rename the `SMOL_ASSETS_URL` / `SMOL_ADDRESS` / `SMOL_ADDRESS_V2` env keys (they leak into `app/` code; rename mechanically in one commit if so).
- `app/manifest.ts` + `app/metadata.ts` + `public/manifest.json` — `siteConfig` name/description/url/ogImage → Fruitful.
- `README.md` — rewrite (it still describes the even older "Migratooor"; this is the moment to fix it).
- `CLAUDE.md` — update project description after the rename lands.

### 1b. UI strings and assets (user-visible)

- Branding strings in `app/(apps)/page.tsx`, `app/not-found.tsx`, `app/_components/SideMenu/`, `app/_components/SuccessModal.tsx`, `app/(apps)/pixel/` and the `_appInfo` blurbs.
- `public/` artwork needs Fruitful replacements: `og.png`, `smol.svg`, `smol-lp.riv` (Rive animation), `smol-swap.mp4`, `avatar.png`, `cover.jpg`, `hero.jpg`, favicons. The `.riv` and `.mp4` need design work — budget for it or remove those sections initially.

### 1c. Internal identifiers (optional second pass)

- `Smol*` component names (`SmolAddressInput`, `SmolTokenSelector`, …), `TSmolChains`, etc. Purely mechanical rename; do it in a dedicated commit with no behavior changes so it's reviewable.
- Token-list URLs point at `github.com/SmolDapp/tokenLists` (`WithTokenList.tsx:78`, `usePopularTokens.tsx:28`, `Providers.tsx`). These keep working (they're public), but they contain no Pelagia (chain 13939) tokens — see Phase 3. Eventually host a Fruitful token list.

---

## Phase 2 — Add Reef Pelagia to the chain registry

All chain support lives in `app/_utils/tools.chains.ts`. viem has no built-in Pelagia definition, so define it locally:

```ts
const reefPelagia = defineChain({
	id: 13939,
	name: 'Reef Pelagia',
	nativeCurrency: {name: 'Reef', symbol: 'REEF', decimals: 12},
	rpcUrls: {
		default: {http: ['https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/']}
	},
	blockExplorers: {
		default: {name: 'Reefscout', url: 'https://explorer-frontend-ibcy8d-1204c4-72-60-35-83.nip.io/'}
	},
	contracts: {
		multicall3: {address: '0x…', blockCreated: 0} // ← from the deployment guide
	},
	testnet: true
});
```

Then the `CHAINS` entry:

```ts
[reefPelagia.id]: {
	...reefPelagia,
	isLifiSwapSupported: false,      // LiFi has no Pelagia support
	isMultisafeSupported: false,     // no Safe contracts on PolkaVM
	safeAPIURI: '',
	safeUIURI: '',
	coingeckoGasCoinID: 'reef',      // display-only; testnet REEF has no real value
	llamaChainName: undefined,       // DefiLlama has no Pelagia prices
	disperseAddress: toAddress('0x…'), // ← from the deployment guide
	yearnRouterAddress: undefined,
	rpcUrls: assignRPCUrls(reefPelagia)
}
```

Supporting changes:

1. **`next.config.js`**: add `13939: process.env.RPC_URI_FOR_13939` to `RPC_URI_FOR` so the RPC URL is env-overridable (the nip.io default will rot).
2. **Testnet gating (the big gotcha)**: `useWallet.tsx:103` skips any `chain.testnet` unless `shouldWorkOnTestnet`, and `Providers.tsx` only enables that in dev with `SHOULD_USE_FORKNET`. With `testnet: true`, Pelagia balances would never load in production. Recommended fix: replace the boolean with a per-chain allowlist (or add `isEnabledInProd` to `TSmolChains`) rather than lying about `testnet: false` — `supportedNetworks`/`supportedTestNetworks` filtering in `tools.chains.ts:506` and `WithPrices` both key off that flag.
3. **Chain-list scope decision**: "port to Pelagia" reads as Pelagia-first. Recommendation: keep **mainnet + Pelagia** in the wagmi config and trim the other ~30 chains from `CHAINS` (or gate them behind a flag). Mainnet must stay because `useENS.ts` (and Clusters lookups) hardcode chain 1 for name resolution; removing it breaks address-book/send name inputs.
4. **12-decimals audit**: grep for hardcoded 18s touching the *native* token. Known suspects: `tools.erc20.ts:96` (default decimals when a token read fails), `numbers.ts:101` (`zeroNormalizedBN` at 18 — fine as a zero, but verify consumers), `multisafe/components/ChainStatus.tsx:301` (`parseEther` for fees — moot since multisafe is disabled on Pelagia). Everything else flows `token.decimals`/`chain.nativeCurrency.decimals` through viem, which handles 12 correctly.
5. **Verify, don't trust**: before relying on 12 decimals, drip 2,000 REEF from the faucet and check the raw `eth_getBalance` (expect `2_000 × 10¹²`). `pallet-revive` deployments sometimes re-scale native balances at the EVM RPC layer; the deployment guide includes this check.

---

## Phase 3 — Per-app triage on Pelagia

| App | Status on Pelagia | Work needed |
| --- | --- | --- |
| **send** | Works once the chain is registered | Token discovery is empty (no Pelagia tokens in SmolDapp lists); users can paste token addresses. Optionally publish a Fruitful token list for Pelagia test tokens. |
| **disperse** | Needs the Disperse contract deployed | See deployment guide; set `disperseAddress`. |
| **wallet** | Needs Multicall3 deployed | `useBalances.multichains.ts:249` falls back to the canonical Multicall3 address, which doesn't exist on Pelagia — the chain's `contracts.multicall3` entry is mandatory, otherwise every balance read reverts. |
| **swap** | Not portable | LiFi doesn't support Pelagia. `isLifiSwapSupported: false` and hide the nav entry when the active chain is Pelagia. |
| **multisafe** | Not portable | Safe singleton/proxy-factory don't exist on PolkaVM (and CREATE2-based cross-chain address parity wouldn't hold anyway). `isMultisafeSupported: false`, hide nav entry. |
| **revoke** | Should work — verify | Relies on `eth_getLogs` range scans (`useInfiniteContractLogs`). Confirm the Pelagia RPC's log-range limits; tune chunk size if needed. |
| **address-book** | Works | IndexedDB, chain-agnostic. ENS/Clusters resolution keeps using mainnet. |
| **prices** | Degraded by design | No DefiLlama/yDaemon coverage for Pelagia → token prices show as 0/unknown. Acceptable for a testnet; make sure UI degrades gracefully rather than blocking flows. |
| **token icons** | Degraded | `SMOL_ASSETS_URL` has no chain-13939 assets; `ImageWithFallback` already handles fallbacks. |

---

## Phase 4 — Contract deployment

Two contracts are required, both small and PolkaVM-compatible once recompiled with `resolc`:

1. **Multicall3** (source: `github.com/mds1/multicall`, Solidity 0.8.12) — for batched balance reads.
2. **Disperse** — the original disperse.app contract is Solidity 0.4.x and must be ported to ≥ 0.8.0. The ABI consumed by the app (`app/_utils/abi/disperse.abi.ts`: `disperseEther`, `disperseToken`, `disperseTokenSimple`) must be preserved exactly.

The full step-by-step procedure (wallet setup, faucet, Hardhat + `@parity/hardhat-polkadot`, ported Disperse source, verification, hand-off) is in [pelagia-contract-deployment.md](./pelagia-contract-deployment.md).

After deployment, the addresses land in exactly two places in `tools.chains.ts`: `contracts.multicall3` and `disperseAddress` on the Pelagia entry.

---

## Risks and open questions

- **RPC/explorer/faucet URL stability**: nip.io cluster hostnames already differ across doc pages; expect rotation. Mitigation: env-injected RPC, and re-check docs.reef.io before launch.
- **Testnet resets**: Reef documents that Pelagia state may be reset on upgrades. All deployments must be re-runnable from the guide; the app config must make address swaps a one-line change (it does).
- **Chain-ID collision**: 13939 is shared with legacy Reef mainnet. Harmless unless both networks are ever configured simultaneously (wagmi keys chains by ID) — never add both.
- ~~**Native decimals**~~ **Resolved**: confirmed 12-decimal REEF on Pelagia (and on mainnet once the upgrade ships). The on-chain check in the deployment guide remains as a sanity step.
- **Blockscout verification of resolc artifacts**: contract verification tooling for `pallet-revive` is younger than solc's; the guide treats verification as best-effort with a manual fallback.
- ~~**PWA/`next-pwa` + analytics**~~ **Resolved**: the app deploys to <https://fruitful.sponsian.org>; manifests, Plausible, and WalletConnect metadata point there.

## Suggested execution order

1. Phase 2 chain registry + testnet gating fix (app runs against Pelagia read-only).
2. Phase 4 contract deployments (unblocks disperse + wallet balances).
3. Phase 3 triage: gate swap/multisafe, verify revoke + send end-to-end with faucet REEF.
4. Phase 1 rename + assets last (or in parallel by a non-engineer for artwork) — it touches the most files and is easiest to review when functional changes are already merged.
