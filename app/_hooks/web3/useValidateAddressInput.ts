import {Clusters} from '@clustersxyz/sdk';
import {useState} from 'react';

import {useAddressBook} from '@lib/contexts/useAddressBook';
import {defaultInputAddressLike, isAddress, toAddress} from '@lib/utils/tools.addresses';

import type {TInputAddressLike} from '@lib/utils/tools.addresses';

export function useValidateAddressInput(): {
	validate: (signal: AbortSignal | undefined, input: string) => Promise<TInputAddressLike>;
	isCheckingValidity: boolean;
} {
	const {getEntry} = useAddressBook();
	const [isCheckingValidity, setIsCheckingValidity] = useState<boolean>(false);

	const validate = async (signal: AbortSignal | undefined, input: string): Promise<TInputAddressLike> => {
		if (!input || input === '') {
			return defaultInputAddressLike;
		}

		/**********************************************************
		 ** Check if the input is an address from the address book
		 **********************************************************/
		const fromAddressBook = await getEntry({label: input, address: toAddress(input)});
		if (fromAddressBook && !fromAddressBook.isHidden) {
			if (signal?.aborted) {
				throw new Error('Aborted!');
			}

			return {
				address: toAddress(fromAddressBook.address),
				label: fromAddressBook.label,
				isValid: true,
				error: undefined,
				source: 'addressBook'
			};
		}

		/******************************************************************************************
		 ** Check if the input is an address. ENS resolution is intentionally omitted: Fruitful does
		 ** not connect to Ethereum (see app/_utils/tools.chains.ts), so Clusters is the name source.
		 *****************************************************************************************/
		if (isAddress(input)) {
			if (signal?.aborted) {
				throw new Error('Aborted!');
			}
			setIsCheckingValidity(true);
			const clusters = new Clusters();
			const clusterName = await clusters.getName(toAddress(input));

			if (signal?.aborted) {
				throw new Error('Aborted!');
			}
			setIsCheckingValidity(false);

			return {
				address: toAddress(input),
				label: clusterName?.clusterName || toAddress(input),
				error: undefined,
				isValid: true,
				source: 'typed'
			};
		}

		/******************************************************************************************
		 ** Check if the input is a clusters handle by checking if it ends with `/`
		 *****************************************************************************************/
		const lowercaseInput = input.toLowerCase();
		if (lowercaseInput.endsWith('/') || lowercaseInput.includes('/')) {
			if (signal?.aborted) {
				throw new Error('Aborted!');
			}
			setIsCheckingValidity(true);
			const clusters = new Clusters();
			const clusterAddresses = await clusters.getAddresses([lowercaseInput]);
			if (signal?.aborted) {
				throw new Error('Aborted!');
			}
			const clusterAddress = clusterAddresses[0];
			setIsCheckingValidity(false);

			if (clusterAddress && clusterAddress?.type === 'evm' && isAddress(clusterAddress.address)) {
				return {
					address: toAddress(clusterAddress.address),
					label: lowercaseInput || clusterAddress.clusterName || toAddress(clusterAddress.address),
					error: undefined,
					isValid: true,
					source: 'typed'
				};
			}
		}

		return {
			address: undefined,
			label: input,
			isValid: false,
			error: 'This address looks invalid',
			source: 'typed'
		};
	};

	return {isCheckingValidity, validate};
}
