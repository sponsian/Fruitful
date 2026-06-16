# Deploying Fruitful's contracts on Reef Pelagia testnet

Step-by-step guide for deploying the two contracts Fruitful needs on Reef Pelagia: **Multicall3** (batched balance reads) and **Disperse** (the disperse app). No other contracts are required — send, revoke, wallet, and address-book use only these plus standard ERC-20 calls.

> **Why this isn't a normal EVM deployment.** Pelagia executes contracts on **PolkaVM via `pallet-revive`**, not the standard EVM. Contracts must be Solidity ≥ 0.8.0 and compiled with **`resolc`** (not `solc`). The `@parity/hardhat-polkadot` plugin handles this. Canonical addresses you know from other chains (Multicall3 at `0xcA11…ca11`, Disperse at `0xD152…2150`) do **not** exist here and cannot be reproduced — you deploy fresh and record your own addresses.

> **Read this first — it will save you an hour.** The `@parity/hardhat-polkadot@0.1.9` toolchain is fiddly: it targets **Hardhat 2** (not 3), has a missing transitive dependency, doesn't bundle the resolc compiler, and the Hardhat 3 `--init` wizard actively fights you. **Do not use the `npx hardhat --init` wizard.** Follow the manual setup in §5 exactly — every dependency and config value below is there because something breaks without it. The Troubleshooting section (§12) lists each error we hit and why, in case your versions drift.

## 1. Prerequisites

- Node.js 20+ and npm
- A **fresh, testnet-only private key**. Never reuse a key that holds real funds.
- `zsh` users: note that `^` is a glob character, so version specs like `hardhat@^2.28.0` **must be quoted** (`"hardhat@^2.28.0"`) or you'll get `zsh: no matches found`. All commands below are already quoted.

## 2. Add Reef Pelagia to your wallet

MetaMask → network selector → "Add a custom network":

| Field | Value |
| --- | --- |
| Network name | Reef Pelagia |
| RPC URL | `https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/` |
| Chain ID | `13939` |
| Currency symbol | `REEF` |
| Block explorer | `https://explorer-frontend-ibcy8d-1204c4-72-60-35-83.nip.io/` |

> The RPC/explorer hostnames are auto-generated and may rotate. If they fail, get the current ones from <https://docs.reef.io/docs/developers/networks/>.

## 3. Fund the deployer from the faucet

1. Open `https://faucet.reef-node-reefdevcluster-6058af-72-60-35-83.nip.io/`
2. Paste your deployer's `0x…` address (EVM format, not a Substrate `5…` address) and click **Send drip**.
3. You receive **2,000 REEF** within ~30 seconds. The faucet is rate-limited per address and IP; if you need more, ask in the Reef Discord `#dev-support` channel instead of looping drips.

Testnet REEF has no value and cannot be bridged to mainnet.

## 4. Sanity-check the network before deploying

REEF on Pelagia has **12 decimals** (confirmed for Pelagia and for mainnet after the upgrade). Confirm both the chain ID and the decimal scaling before anything else:

```bash
# Chain ID — expect 0x3673 (13939)
curl -s -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/

# Raw balance after one 2,000 REEF drip
curl -s -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["<YOUR_ADDRESS>","latest"],"id":1}' \
  https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/
```

A 2,000 REEF drip at 12 decimals is `2000 × 10¹² = 0x71afd498d0000`. If you instead see a value around `10²¹`, the RPC layer is scaling to 18 decimals — **stop and report back**, because the app's chain config (`nativeCurrency.decimals`) must match what `eth_getBalance` returns.

## 5. Set up the Hardhat project (manual — do NOT use the init wizard)

The contracts live in their **own standalone project, separate from the Fruitful dapp repo.** This is mandatory: the dapp is on React 19, and installing anything into it re-triggers npm peer resolution that fails on `@gnosis.pm/safe-apps-react-sdk` (React ≤18). A clean directory has none of that.

```bash
cd ..                                   # leave the fruitful dapp repo
mkdir fruitful-pelagia-contracts && cd fruitful-pelagia-contracts
npm init -y
```

Install the **exact** dependency set below. Each is here for a reason (see §12); the standard `hardhat-toolbox` is deliberately omitted — you don't need typechain/ignition/gas-reporter/coverage to deploy two contracts, and the toolbox drags in peer conflicts.

```bash
npm install --save-dev \
  "hardhat@^2.28.0" \
  "@parity/hardhat-polkadot@0.1.9" \
  "@parity/resolc" \
  "@nomicfoundation/hardhat-ethers@^3.0.0" \
  "ethers@^6" \
  "run-container" \
  "dotenv" \
  "typescript@~5.6" "ts-node" "@types/node"
```

Why these (the non-obvious ones):
- **`hardhat@^2.28.0`** — the plugin peer-requires Hardhat 2. `^2.28.0` satisfies both the Parity plugin (`^2.26.0`) and `@nomicfoundation/hardhat-ethers` (`^2.28.0`). Do **not** let a Hardhat 3 get installed.
- **`@parity/resolc`** — the actual resolc compiler. `@parity/hardhat-polkadot` does **not** bundle it; without it the compiler version resolves to `undefined`.
- **`run-container`** — a transitive dependency that `@parity/hardhat-polkadot-node`'s `docker-server.js` requires but forgets to declare. Without it, the config fails to even load. You never run the Docker node (you deploy to the remote RPC); it just has to resolve.
- **`dotenv`** — Hardhat 2 does not auto-load `.env`. Without it `DEPLOYER_PRIVATE_KEY` is `undefined`.
- **`typescript@~5.6`** — Hardhat 2's toolchain targets TS 5.x. An unpinned `typescript` pulls a 6.x/7.x build whose stricter deprecation handling breaks the config (see §12).

Now create the project files by hand (the wizard is not used).

`hardhat.config.ts`:

```ts
import 'dotenv/config';
import '@nomicfoundation/hardhat-ethers';
import '@parity/hardhat-polkadot';

import type {HardhatUserConfig} from 'hardhat/config';

const config: HardhatUserConfig = {
	solidity: '0.8.28',
	resolc: {
		// Pin the resolc version explicitly. Read the installed version with:
		//   grep '"version"' node_modules/@parity/resolc/package.json | head -1
		// and paste it here. With compilerSource 'npm', leaving this unset makes
		// the plugin report "Resolc version undefined is invalid".
		version: 'PASTE_RESOLC_VERSION_HERE',
		compilerSource: 'npm',
		settings: {
			optimizer: {enabled: true, runs: 200}
		}
	},
	networks: {
		pelagia: {
			polkavm: true,
			url: process.env.PELAGIA_RPC || 'https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/',
			chainId: 13939,
			accounts: [process.env.DEPLOYER_PRIVATE_KEY as string]
		}
	}
};

export default config;
```

Fill in the resolc version:

```bash
grep '"version"' node_modules/@parity/resolc/package.json | head -1
```

`tsconfig.json` — use this CommonJS config exactly. Hardhat 2 + ts-node run on CommonJS; the wizard-generated tsconfig mixes `module: NodeNext` with `moduleResolution: node10`, which is a hard contradiction (TS5109):

```json
{
	"compilerOptions": {
		"target": "es2020",
		"module": "commonjs",
		"moduleResolution": "node",
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"strict": true,
		"skipLibCheck": true,
		"resolveJsonModule": true
	}
}
```

`.env` (project root — **add it to `.gitignore` first**; no quotes, no spaces around `=`):

```
DEPLOYER_PRIVATE_KEY=0xyour64hexcharprivatekey
PELAGIA_RPC=https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/
```

The private key **must** include the `0x` prefix and be 64 hex chars after it (66 total) — Hardhat rejects a bare key.

```bash
echo ".env" >> .gitignore
echo "node_modules" >> .gitignore
```

Notes:
- The plugin compiles via `resolc` to PolkaVM blobs. The code-size limit is 100 KB (vs 24 KB on Ethereum) — both contracts here are far under it.
- Hardhat Network test helpers (`time`, `loadFixture`) are **not supported** against Pelagia; keep on-chain tests to plain transactions.

## 6. Add the contracts

Create a `contracts/` directory.

### 6a. Multicall3

Copy `Multicall3.sol` from <https://github.com/mds1/multicall> (MIT licensed) into `contracts/Multicall3.sol`. It ships with an **exact** version pragma — `pragma solidity 0.8.12;` — which won't match the `0.8.28` compiler configured above (HH606). Loosen just that line:

```solidity
// change this:
pragma solidity 0.8.12;
// to this:
pragma solidity ^0.8.12;
```

This is safe — there are no breaking language changes within 0.8.x that affect Multicall3; the exact pin was the author's preference. Do not otherwise modify the file — the app calls `aggregate3` and `getEthBalance` and expects the standard ABI.

### 6b. Disperse (ported to Solidity 0.8)

The original disperse.app contract is Solidity 0.4.x, which `resolc` cannot compile. Use this port — **function names and signatures must stay exactly as below**, because the app's ABI (`app/_utils/abi/disperse.abi.ts`) is fixed:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract Disperse {
    function disperseEther(address[] calldata recipients, uint256[] calldata values) external payable {
        for (uint256 i = 0; i < recipients.length; i++) {
            (bool success, ) = recipients[i].call{value: values[i]}("");
            require(success, "Disperse: ETH transfer failed");
        }
        uint256 remaining = address(this).balance;
        if (remaining > 0) {
            (bool success, ) = msg.sender.call{value: remaining}("");
            require(success, "Disperse: refund failed");
        }
    }

    function disperseToken(IERC20 token, address[] calldata recipients, uint256[] calldata values) external {
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            total += values[i];
        }
        require(token.transferFrom(msg.sender, address(this), total), "Disperse: transferFrom failed");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(token.transfer(recipients[i], values[i]), "Disperse: transfer failed");
        }
    }

    function disperseTokenSimple(IERC20 token, address[] calldata recipients, uint256[] calldata values) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            require(token.transferFrom(msg.sender, recipients[i], values[i]), "Disperse: transferFrom failed");
        }
    }
}
```

(The port replaces the original's `transfer()` with `.call{value: …}` — the 2300-gas stipend assumption doesn't hold on PolkaVM.)

## 7. Compile

```bash
npx hardhat compile
```

resolc takes a few seconds longer than plain solc since it produces PolkaVM bytecode. If you hit an error here, it's almost certainly in §12.

## 8. Deploy

Create `scripts/deploy.ts`:

```ts
import {ethers} from 'hardhat';

async function main(): Promise<void> {
	const multicall3 = await ethers.deployContract('Multicall3');
	await multicall3.waitForDeployment();
	console.log('Multicall3:', await multicall3.getAddress());

	const disperse = await ethers.deployContract('Disperse');
	await disperse.waitForDeployment();
	console.log('Disperse:', await disperse.getAddress());
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
```

```bash
npx hardhat run scripts/deploy.ts --network pelagia
```

Record for each contract: **address, deployment tx hash, and block number** (block number goes into the app config as `blockCreated`). Blocks are ~10s, so confirmation is quick.

> If you see an `npm audit` summary with vulnerabilities printed during a run, ignore it, and **do not run `npm audit fix --force`** — it will upgrade Hardhat/plugins across breaking major versions and undo this setup.

## 9. Verify on Blockscout (best-effort)

Open the explorer, find each contract address, and use the "Verify & publish" flow if available. Verification tooling for `resolc`/PolkaVM artifacts is newer than solc's — if the explorer rejects the artifacts, skip verification (the app doesn't depend on it) and note it for later.

## 10. Smoke-test

From the Hardhat console (`npx hardhat console --network pelagia`):

1. **Multicall3**: call `getEthBalance(<your address>)` and check it matches `eth_getBalance`.
2. **Disperse**: call `disperseEther([addrA, addrB], [v1, v2])` with a small `value: v1 + v2` and confirm both recipients receive funds on the explorer. Remember values are in 12-decimal REEF units — `1 REEF = 10¹²`, so use `ethers.parseUnits('1', 12)`, **not** `parseEther`.

## 11. Hand-off: wire the addresses into the app

In the Fruitful repo, edit the Reef Pelagia entry in `app/_utils/tools.chains.ts`:

- Add a `contracts.multicall3` entry to the `reefPelagia` chain definition: `{address: '0x…', blockCreated: <block>}`
- Set `disperseAddress` on the Pelagia `CHAINS` entry to the Disperse address.

And make sure the deployment RPC URL is reflected in the dapp's `.env` as `RPC_URI_FOR_13939`.

The disperse button stays disabled while `disperseAddress` is the zero address, and wallet balance reads need `contracts.multicall3`, so both must be filled in for those apps to work on Pelagia.

## 12. Troubleshooting (errors we actually hit, in order)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `zsh: no matches found: hardhat@^2.28.0` | zsh treats `^` as a glob | Quote the spec: `"hardhat@^2.28.0"` |
| `npm error ERESOLVE … react@19 … @gnosis.pm/safe-apps-react-sdk` | You're installing inside the **dapp repo** | Use the standalone `fruitful-pelagia-contracts` dir (§5) |
| `Error HHE3: No Hardhat config file found` (from `npx hardhat init`) | Hardhat 3 uses `--init`, not the `init` subcommand | Don't use the wizard at all — manual setup (§5) |
| ERESOLVE: `peer hardhat@^2.28.0 … Found: hardhat@3.9.0` | The `--init` wizard pinned Hardhat 3 while installing Hardhat-2 plugins | Pin `"hardhat@^2.28.0"`; build the project manually (§5) |
| `TS5109: moduleResolution must be NodeNext when module is NodeNext` | Wizard-generated `tsconfig.json` mixes incompatible settings | Use the CommonJS `tsconfig.json` in §5 |
| `TS5103: Invalid value for '--ignoreDeprecations'` | `"ignoreDeprecations": "6.0"` on TS 5.x (only accepts `"5.0"`) | Remove the line; on TS 5.x it isn't needed (and pin `typescript@~5.6`) |
| `Cannot find module 'run-container'` | Missing transitive dep in `@parity/hardhat-polkadot-node` | `npm i -D run-container` |
| `Cannot find module '@parity/hardhat-polkadot-resolc'` | Importing the resolc subpackage directly when it's only nested | Import the meta package `@parity/hardhat-polkadot` instead |
| `HH8: Invalid account #0 … Expected string, received undefined` | `.env` not loaded; key undefined | `npm i -D dotenv` + `import 'dotenv/config'` as the first line of the config; key needs `0x` prefix |
| `HH606: pragma … doesn't match … (0.8.12)` | `Multicall3.sol` pins exact `0.8.12` | Change its pragma to `^0.8.12` (§6a) |
| `Resolc version undefined is invalid or hasn't been released yet` | resolc compiler not installed / version unset | `npm i -D @parity/resolc`, then pin `resolc.version` in the config to the installed version |

## 13. Expect to do this again

Reef states Pelagia **may be reset on upgrades**, wiping all contracts. Keep this project in the Fruitful org so the whole procedure is: faucet → `npx hardhat run scripts/deploy.ts --network pelagia` → update the two config lines in `tools.chains.ts`.
