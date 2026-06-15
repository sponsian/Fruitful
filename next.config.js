/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
const {withPlausibleProxy} = require('next-plausible');
const withPWA = require('next-pwa')({
	dest: 'public',
	disable: process.env.NODE_ENV !== 'production'
});

module.exports = withPlausibleProxy({
	scriptName: 'script',
	customDomain: 'https://fruitful.sponsian.org'
})(
	withPWA({
		typescript: {
			ignoreBuildErrors: true,
		},
		experimental: {
			externalDir: true
		},
		images: {
			domains: [
				'gib.to',
				'rawcdn.githack.com',
				'raw.githubusercontent.com',
				'ipfs.io',
				's3.amazonaws.com',
				'1inch.exchange',
				'hut34.io',
				'www.coingecko.com',
				'defiprime.com',
				'cdn.furucombo.app',
				'gemini.com',
				'messari.io',
				'ethereum-optimism.github.io',
				'tryroll.com',
				'logo.assets.tkn.eth.limo',
				'umaproject.org',
				'cloudflare-ipfs.com',
				'assets.smold.app'
			]
		},
		transpilePackages: ['lib'],
		redirects() {
			return [];
		},
		async rewrites() {
			return [
				{
					source: '/js/script.js',
					destination: 'https://plausible.io/js/script.js'
				},
				{
					source: '/api/event',
					destination: 'https://plausible.io/api/event'
				}
			];
		},
		env: {
			PROJECT_SLUG: 'fruitful',
			RPC_URI_FOR: {
				/**********************************************************************************
				 ** Supported networks: Ethereum mainnet (kept for ENS/Clusters name resolution)
				 ** and Reef Pelagia testnet. The Pelagia default RPC hostname is an auto-generated
				 ** cluster name and may rotate — always set RPC_URI_FOR_13939 in production.
				 *********************************************************************************/
				1: process.env.RPC_URI_FOR_1,
				13939: process.env.RPC_URI_FOR_13939
			},
			/**********************************************************************************
			 ** Legacy RPC configuration, read as a fallback by assignRPCUrls
			 *********************************************************************************/
			JSON_RPC_URL: {
				1: process.env.RPC_URI_FOR_1
			},
			/**********************************************************************************
			 ** Wallet Connect configuration
			 *********************************************************************************/
			WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
			WALLETCONNECT_PROJECT_NAME: 'Fruitful',
			WALLETCONNECT_PROJECT_DESCRIPTION:
				'Simple, smart and elegant dapps, designed to make your crypto journey a little bit easier.',
			WALLETCONNECT_PROJECT_URL: 'https://fruitful.sponsian.org',
			WALLETCONNECT_PROJECT_ICON: 'https://fruitful.sponsian.org/favicons/ms-icon-310x310.png',

			SHOULD_USE_FORKNET: process.env.SHOULD_USE_FORKNET === 'true',

			SMOL_ASSETS_URL: 'https://assets.smold.app/api',
			SMOL_ADDRESS: '0x10001192576E8079f12d6695b0948C2F41320040',
			SMOL_ADDRESS_V2: '0x200010672cDB08a33547fA9C0372f622dfDAEB40',
			PLAUSIBLE_DOMAIN: 'fruitful.sponsian.org'
		}
	})
);
