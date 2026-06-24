type TENS = {name: string; avatar: string; isLoading: boolean};

/**************************************************************************************************
 ** ENS is an Ethereum-only name system and Fruitful no longer connects to Ethereum (see
 ** app/_utils/tools.chains.ts). This hook is intentionally a no-op so nothing queries mainnet;
 ** Clusters name resolution (useClusters) remains available as the name source.
 *************************************************************************************************/
export function useENS(): TENS {
	return {name: '', avatar: '', isLoading: false};
}
