import Image from 'next/image';

import type {ReactElement} from 'react';

export function SideMenuFooter(): ReactElement {
	return (
		<div className={'flex justify-between rounded-b-lg bg-primary px-6 py-3'}>
			<Image
				src={'/fruitful.svg'}
				alt={'fruitful'}
				width={'56'}
				height={'24'}
			/>
			<Image
				src={'/pineapple.svg'}
				alt={'pineapple'}
				width={'32'}
				height={'24'}
			/>
		</div>
	);
}
