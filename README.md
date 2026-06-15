# Fruitful

> Simple, smart and elegant dapps, designed to make your crypto journey a little bit easier — running on the [Reef Pelagia](https://docs.reef.io/docs/developers/pelagia/) testnet.

Fruitful is a suite of small crypto dapps (a fork of [Smol](https://github.com/SmolDapp/smoldapp), rebranded and ported to Reef Pelagia):

- **send** — transfer native REEF and ERC-20 tokens
- **disperse** — send tokens to many addresses in one transaction
- **revoke** — review and revoke ERC-20 allowances
- **address-book** — local, private address book (IndexedDB)
- **wallet** — token balances overview
- **swap** — cross-chain swaps via LiFi (Ethereum mainnet only; LiFi does not support Pelagia)
- **multisafe** — Safe deployment across chains (Ethereum mainnet only; Safe contracts do not exist on PolkaVM)

Live at <https://fruitful.sponsian.org>.

## Networks

| Network | Chain ID | Notes |
| --- | --- | --- |
| Reef Pelagia | 13939 | Primary target. REEF native token with **12 decimals**. PolkaVM via `pallet-revive`. |
| Ethereum mainnet | 1 | Kept for ENS/Clusters name resolution and for the swap/multisafe apps. |

Network support is defined in `app/_utils/tools.chains.ts`. The Disperse and Multicall3 contracts must be deployed on Pelagia and their addresses recorded there — see [docs/pelagia-contract-deployment.md](docs/pelagia-contract-deployment.md). The port plan lives in [docs/pelagia-port-plan.md](docs/pelagia-port-plan.md).

## Develop

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
bun run dev      # Next.js dev server
bun run dev:ts   # TypeScript watch mode (run alongside dev)
```

The build does **not** fail on type errors (`ignoreBuildErrors` is set) — run `tsc --noEmit` to typecheck.

```bash
bun run build            # production build
bun run lint             # ESLint
bun run prettier-format  # Prettier
```

## Configuration

Set environment variables in a `.env` file at the project root:

```bash
# RPC endpoints (the Pelagia default hostname is auto-generated and may rotate —
# always set it explicitly in production; current value at
# https://docs.reef.io/docs/developers/networks/)
RPC_URI_FOR_1=https://eth.llamarpc.com
RPC_URI_FOR_13939=https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io

# WalletConnect (required for wallet connections)
WALLETCONNECT_PROJECT_ID=your_project_id

# Optional: Telegram notifications for the /api/notify and /api/report routes
TELEGRAM_BOT=
TELEGRAM_CHAT=
```

## Getting testnet REEF

Use the [Pelagia faucet](https://docs.reef.io/docs/developers/pelagia-faucet/) — paste your `0x…` address and you'll receive 2,000 REEF within ~30 seconds. Testnet REEF has no real value.

## License

MIT — see [LICENSE](LICENSE). Forked from [SmolDapp/smoldapp](https://github.com/SmolDapp/smoldapp).
