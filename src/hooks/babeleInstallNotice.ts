import localize from '../utils/localize.js';

function isEnglish(lang: string | undefined): boolean {
	return !lang || lang === 'en' || lang.startsWith('en-');
}

function isBabeleActive(): boolean {
	return game.modules?.get('babele')?.active === true;
}

function showInstallNotice(lang: string): void {
	ui.notifications?.warn(localize('NIMBLE.babele.notInstalled', { lang }), {
		permanent: true,
	});
}

export default function registerBabeleInstallNotice(): void {
	Hooks.once('ready', () => {
		const lang = game.i18n?.lang;
		if (isEnglish(lang)) return;
		if (isBabeleActive()) return;
		showInstallNotice(lang ?? '');
	});
}
