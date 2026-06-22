import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooksOnce = vi.fn();
const notificationsWarn = vi.fn();
const i18nFormat = vi.fn((key: string, data?: Record<string, string>) =>
	data ? `${key}|${JSON.stringify(data)}` : key,
);
const i18nLocalize = vi.fn((key: string) => key);
const modulesGet = vi.fn<(id: string) => { active: boolean } | undefined>();

vi.stubGlobal('Hooks', {
	on: vi.fn(),
	once: hooksOnce,
	off: vi.fn(),
	call: vi.fn(),
	callAll: vi.fn(),
});
vi.stubGlobal('ui', { notifications: { warn: notificationsWarn } });
vi.stubGlobal('game', {
	i18n: { lang: 'en', localize: i18nLocalize, format: i18nFormat },
	modules: { get: modulesGet },
});

import registerBabeleInstallNotice from './babeleInstallNotice.js';

function runReadyHandler(opts: { lang: string | undefined; babeleActive: boolean | undefined }) {
	hooksOnce.mockReset();
	notificationsWarn.mockReset();
	(game as { i18n: { lang: string | undefined } }).i18n.lang = opts.lang;
	modulesGet.mockReset();
	modulesGet.mockImplementation((id: string) =>
		id === 'babele' && opts.babeleActive !== undefined ? { active: opts.babeleActive } : undefined,
	);

	registerBabeleInstallNotice();
	expect(hooksOnce).toHaveBeenCalledWith('ready', expect.any(Function));
	const handler = hooksOnce.mock.calls[0][1] as () => void;
	handler();
}

describe('babeleInstallNotice', () => {
	beforeEach(() => {
		notificationsWarn.mockReset();
	});

	it('does not warn when the world language is English', () => {
		runReadyHandler({ lang: 'en', babeleActive: false });
		expect(notificationsWarn).not.toHaveBeenCalled();
	});

	it('does not warn for English regional variants (en-US)', () => {
		runReadyHandler({ lang: 'en-US', babeleActive: false });
		expect(notificationsWarn).not.toHaveBeenCalled();
	});

	it('does not warn when Babele is installed and active', () => {
		runReadyHandler({ lang: 'fr', babeleActive: true });
		expect(notificationsWarn).not.toHaveBeenCalled();
	});

	it('warns when language is non-English and Babele is missing', () => {
		runReadyHandler({ lang: 'fr', babeleActive: undefined });
		expect(notificationsWarn).toHaveBeenCalledTimes(1);
		const [message, options] = notificationsWarn.mock.calls[0];
		expect(message).toContain('NIMBLE.babele.notInstalled');
		expect(message).toContain('"lang":"fr"');
		expect(options).toEqual({ permanent: true });
	});

	it('warns when language is non-English and Babele is present but disabled', () => {
		runReadyHandler({ lang: 'es', babeleActive: false });
		expect(notificationsWarn).toHaveBeenCalledTimes(1);
		expect(notificationsWarn.mock.calls[0][0]).toContain('"lang":"es"');
	});
});
