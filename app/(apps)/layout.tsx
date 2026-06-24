'use client';

import {IconAppAddressBook, IconAppDisperse, IconAppRevoke, IconAppSend} from '@lib/components/icons/IconApps';
import {IconWallet} from '@lib/components/icons/IconWallet';
import {SideMenu} from '@lib/components/SideMenu';
import {SideMenuMobile} from '@lib/components/SideMenu/SideMenuMobile';
import {WithAddressBook} from '@lib/contexts/useAddressBook';
import AppHeading from 'app/(apps)/_appHeading';
import AppInfo from 'app/(apps)/_appInfo';

import type {ReactElement, ReactNode} from 'react';

const MENU = [
	{
		href: '/wallet',
		label: 'Wallet',
		icon: <IconWallet />
	},
	{
		href: '/send',
		label: 'Send',
		icon: <IconAppSend />
	},
	{
		href: '/disperse',
		label: 'Disperse',
		icon: <IconAppDisperse />
	},
	{
		href: '/address-book',
		label: 'Address Book',
		icon: <IconAppAddressBook />
	},
	{
		href: '/revoke',
		label: 'Revoke',
		icon: <IconAppRevoke />
	}
	/**********************************************************************************************
	 ** Swap (LiFi) and Multisafe (Safe contracts) are not supported on Reef Pelagia, so they are
	 ** hidden from the navigation. See docs/pelagia-port-plan.md.
	 *********************************************************************************************/
];

export default function RootLayout(props: {children: ReactNode}): ReactElement {
	return (
		<div className={'grid w-full grid-cols-root'}>
			<nav
				className={
					'sticky top-10 z-20 col-sidebar hidden h-app flex-col rounded-lg bg-neutral-0 md:ml-3 md:flex lg:ml-4 '
				}>
				<SideMenu menu={MENU} />
			</nav>

			<div className={'col-span-full mb-4 flex px-4 md:hidden'}>
				<SideMenuMobile menu={MENU} />
			</div>

			<div className={'col-span-full px-4 md:col-main md:px-3 lg:px-4'}>
				<div className={'relative mb-10 min-h-app w-full overflow-x-hidden rounded-lg bg-neutral-0'}>
					<WithAddressBook>
						<div>
							<div className={'flex w-full justify-end'}>
								<AppInfo />
							</div>
							<section className={'-mt-2 w-full p-4 md:p-8'}>
								<AppHeading />
								{props.children}
							</section>
						</div>
					</WithAddressBook>
				</div>
			</div>
		</div>
	);
}
