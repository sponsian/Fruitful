/* eslint-disable object-curly-newline */
'use client';

import {zeroAddress} from 'viem';

import {toAddress} from '@lib/utils/tools.addresses';

import type {TAddress} from '@lib/utils/tools.addresses';
import type {Chain} from 'viem';

type TSmolChains = Record<
	number,
	Chain & {
		isEnabledInProd: boolean;
		isLifiSwapSupported: boolean;
		isMultisafeSupported: boolean;
		safeAPIURI: string;
		safeUIURI: string;
		coingeckoGasCoinID: string;
		llamaChainName?: string;
		disperseAddress: TAddress;
		yearnRouterAddress: TAddress | undefined;
	}
>;

type TAssignRPCUrls = {
	default: {
		http: string[];
	};
};
function assignRPCUrls(chain: Chain, rpcUrls?: string[]): TAssignRPCUrls {
	const availableRPCs: string[] = [];

	const newRPC = process.env.RPC_URI_FOR?.[chain.id] || '';
	const newRPCBugged = process.env[`RPC_URI_FOR_${chain.id}`];
	const oldRPC = process.env.JSON_RPC_URI?.[chain.id] || process.env.JSON_RPC_URL?.[chain.id];
	const defaultJsonRPCURL = chain?.rpcUrls?.public?.http?.[0];
	const injectedRPC = newRPC || oldRPC || newRPCBugged || defaultJsonRPCURL || '';
	if (injectedRPC) {
		availableRPCs.push(injectedRPC);
	}
	if (chain.rpcUrls['alchemy']?.http[0] && process.env.ALCHEMY_KEY) {
		availableRPCs.push(`${chain.rpcUrls['alchemy']?.http[0]}/${process.env.ALCHEMY_KEY}`);
	}
	if (chain.rpcUrls['infura']?.http[0] && process.env.INFURA_PROJECT_ID) {
		availableRPCs.push(`${chain.rpcUrls['infura']?.http[0]}/${process.env.INFURA_PROJECT_ID}`);
	}

	/**********************************************************************************************
	 ** Make sure to add a proper http object to the chain.rpcUrls.default object.
	 ********************************************************************************************/
	const http = [];
	if (rpcUrls?.length) {
		http.push(...rpcUrls);
	}
	if (injectedRPC) {
		http.push(injectedRPC);
	}
	if (availableRPCs.length) {
		http.push(...availableRPCs);
	}
	http.push(...chain.rpcUrls.default.http);
	return {
		...chain.rpcUrls,
		default: {http}
	};
}

/**************************************************************************************************
 ** Reef Pelagia is the next-generation Reef testnet, running PolkaVM via pallet-revive. It is
 ** EVM-compatible at the RPC layer, but no canonical Ethereum contract (Multicall3, Disperse,
 ** Safe) exists at its usual address — everything must be deployed fresh with resolc. See
 ** docs/pelagia-contract-deployment.md for the deployment procedure.
 ** The RPC and explorer hostnames are auto-generated cluster names and may rotate: always prefer
 ** the env-injected RPC_URI_FOR_13939 and re-check https://docs.reef.io/docs/developers/networks/
 ** if the defaults stop responding.
 ** Note: REEF has 12 decimals on Pelagia (and on mainnet once this upgrade goes live), not 18.
 *************************************************************************************************/
const reefPelagia = {
	id: 13939,
	name: 'Reef Pelagia',
	nativeCurrency: {
		decimals: 12,
		name: 'Reef',
		symbol: 'REEF'
	},
	rpcUrls: {
		default: {http: ['https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io']},
		public: {http: ['https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io']}
	},
	contracts: {
		multicall3: {
			address: '0xEe72bfe4c33c4Ec6Fcdc4358026946dccF63238D',
			blockCreated: 98266
		}
	},
	blockExplorers: {
		default: {
			name: 'Blockscout',
			url: 'https://explorer-frontend-ibcy8d-1204c4-72-60-35-83.nip.io'
		}
	},
	testnet: true
} as const satisfies Chain;

const localhost = {
	id: 1337,
	name: 'Localhost',
	nativeCurrency: {
		decimals: 18,
		name: 'Ether',
		symbol: 'ETH'
	},
	rpcUrls: {
		default: {http: ['http://localhost:8545', 'http://0.0.0.0:8545']},
		public: {http: ['http://localhost:8545', 'http://0.0.0.0:8545']}
	},
	contracts: {
		ensRegistry: {
			address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
		},
		ensUniversalResolver: {
			address: '0xE4Acdd618deED4e6d2f03b9bf62dc6118FC9A4da',
			blockCreated: 16773775
		},
		multicall3: {
			address: '0xca11bde05977b3631167028862be2a173976ca11',
			blockCreated: 14353601
		}
	}
} as const satisfies Chain;

const isDev = process.env.NODE_ENV === 'development' && Boolean(process.env.SHOULD_USE_FORKNET);
const CHAINS: TSmolChains = {
	/**********************************************************************************************
	 ** Reef Pelagia is the only supported network. Ethereum mainnet was intentionally removed so
	 ** the app never reaches out to Ethereum RPCs (which caused CORS errors against the public
	 ** eth.merkle.io endpoint). A consequence is that ENS name/avatar resolution is disabled
	 ** app-wide — ENS is Ethereum-only and the ENS hooks/actions are neutered accordingly. Clusters
	 ** name resolution still works because it uses its own API rather than an Ethereum RPC.
	 ** Reef Pelagia: no LiFi route support, no Safe contracts on PolkaVM, no DefiLlama price
	 ** coverage (llamaChainName stays unset so price lookups skip this chain).
	 ** Multicall3 (reefPelagia.contracts.multicall3) and Disperse (disperseAddress) were deployed
	 ** via docs/pelagia-contract-deployment.md. Pelagia state may be reset on upgrades; if these
	 ** contracts disappear, redeploy and update the addresses here.
	 ********************************************************************************************/
	[reefPelagia.id]: {
		...reefPelagia,
		isEnabledInProd: true,
		isLifiSwapSupported: false,
		isMultisafeSupported: false,
		safeAPIURI: '',
		safeUIURI: '',
		coingeckoGasCoinID: 'reef',
		disperseAddress: toAddress('0x70dd7A82ff52Ed4e85af62bdaB8b9304a7d7D820'),
		yearnRouterAddress: undefined,
		rpcUrls: assignRPCUrls(reefPelagia)
	}
};

if (isDev) {
	CHAINS[localhost.id] = {
		...localhost,
		isEnabledInProd: false,
		isLifiSwapSupported: true,
		isMultisafeSupported: true,
		safeUIURI: 'https://app.safe.global/home?safe=eth:',
		safeAPIURI: 'https://safe-transaction-base.safe.global',
		coingeckoGasCoinID: 'ethereum',
		disperseAddress: zeroAddress,
		yearnRouterAddress: undefined,
		rpcUrls: assignRPCUrls(localhost, ['http://localhost:8545'])
	};
}

/**************************************************************************************************
 ** supportedNetworks is the user-facing list (network selector, address book, send/swap status).
 ** A testnet chain flagged isEnabledInProd (Reef Pelagia) is treated as a user-facing network.
 *************************************************************************************************/
const supportedNetworks: Chain[] = Object.values(CHAINS).filter(e => !e.testnet || e.isEnabledInProd);
const supportedTestNetworks: Chain[] = Object.values(CHAINS).filter(e => e.testnet && !e.isEnabledInProd);
const networks: Chain[] = [...supportedNetworks, ...supportedTestNetworks];

export {CHAINS, networks, supportedNetworks};
