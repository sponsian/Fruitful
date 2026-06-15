# Deploying Fruitful's contracts on Reef Pelagia testnet

Step-by-step guide for deploying the two contracts Fruitful needs on Reef Pelagia: **Multicall3** (batched balance reads) and **Disperse** (the disperse app). No other contracts are required — send, revoke, wallet, and address-book use only these plus standard ERC-20 calls.

> **Why this isn't a normal EVM deployment.** Pelagia executes contracts on **PolkaVM via `pallet-revive`**, not the standard EVM. Contracts must be Solidity ≥ 0.8.0 and compiled with **`resolc`** (not `solc`). The `@parity/hardhat-polkadot` plugin handles this. Canonical addresses you know from other chains (Multicall3 at `0xcA11…ca11`, Disperse at `0xD152…2150`) do **not** exist here and cannot be reproduced — you deploy fresh and record your own addresses.

## 1. Prerequisites

- Node.js 20+ and npm (or bun)
- MetaMask (or any EVM wallet that supports custom networks)
- A **fresh, testnet-only private key**. Never reuse a key that holds real funds.

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

REEF on Pelagia has **12 decimals** (not 18). Confirm both the chain ID and the decimal scaling before anything else:

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

## 5. Set up the Hardhat project

```bash
mkdir fruitful-pelagia-contracts && cd fruitful-pelagia-contracts
npm init -y
npm install --save-dev hardhat @parity/hardhat-polkadot@0.1.9
npx hardhat init   # choose an empty/TypeScript project
```

`hardhat.config.ts`:

```ts
import '@parity/hardhat-polkadot';

import type {HardhatUserConfig} from 'hardhat/config';

const config: HardhatUserConfig = {
	solidity: '0.8.28',
	resolc: {
		compilerSource: 'npm'
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

Put `DEPLOYER_PRIVATE_KEY` and `PELAGIA_RPC` in your shell env or a `.env` you never commit.

Notes:
- The plugin compiles via `resolc` and produces PolkaVM blobs automatically. The code-size limit is 100 KB (vs 24 KB on Ethereum) — both contracts here are far under it.
- Hardhat Network test helpers (`time`, `loadFixture`) are **not supported** against Pelagia; keep on-chain tests to plain transactions.
- Exact config keys can drift between plugin versions — if compilation fails, check the plugin README for `@parity/hardhat-polkadot@0.1.9` and the Reef "Hardhat Materials" docs page.

## 6. Add the contracts

### 6a. Multicall3

Copy `Multicall3.sol` verbatim from <https://github.com/mds1/multicall> (MIT licensed, Solidity ≥ 0.8.12) into `contracts/Multicall3.sol`. Do not modify it — the app calls `aggregate3` and `getEthBalance` and expects the standard ABI.

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

## 7. Deploy

`scripts/deploy.ts`:

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
npx hardhat compile
npx hardhat run scripts/deploy.ts --network pelagia
```

Record for each contract: **address, deployment tx hash, and block number** (block number goes into the app config as `blockCreated`). Blocks are ~10s, so confirmation is quick.

## 8. Verify on Blockscout (best-effort)

Open the explorer, find each contract address, and use the "Verify & publish" flow if available. Verification tooling for `resolc`/PolkaVM artifacts is newer than standard solc verification — if the explorer rejects the artifacts, skip verification (the app doesn't depend on it) and note it for later.

## 9. Smoke-test

From the Hardhat console (`npx hardhat console --network pelagia`):

1. **Multicall3**: call `getEthBalance(<your address>)` and check it matches `eth_getBalance`.
2. **Disperse**: call `disperseEther([addrA, addrB], [v1, v2])` with a small `value: v1 + v2` and confirm both recipients receive funds on the explorer. Remember values are in 12-decimal REEF units — `1 REEF = 10¹²`, so use `ethers.parseUnits('1', 12)`, **not** `parseEther`.

## 10. Hand-off: wire the addresses into the app

In the Fruitful repo, edit the Reef Pelagia entry in `app/_utils/tools.chains.ts`:

- `contracts.multicall3.address` + `blockCreated` → Multicall3 deployment
- `disperseAddress` → Disperse deployment

And make sure the deployment RPC URL is reflected in `.env` as `RPC_URI_FOR_13939`.

## 11. Expect to do this again

Reef states Pelagia **may be reset on upgrades**, wiping all contracts. Keep this project (with the lockfile) in the Fruitful org so the whole procedure is: faucet → `npx hardhat run scripts/deploy.ts --network pelagia` → update the two config lines.
