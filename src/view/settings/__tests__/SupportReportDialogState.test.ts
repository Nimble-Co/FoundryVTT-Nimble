import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SupportReport } from '../../../support/supportReport.js';

const pending: Array<(report: SupportReport) => void> = [];
const collectSupportReport = vi.fn(
	() => new Promise<SupportReport>((resolve) => pending.push(resolve)),
);

let createState: typeof import('../SupportReportDialogState.svelte.ts').createSupportReportDialogState;
// The module gets a new Svelte copy after resetModules, so its effects need a root from that copy.
let effectRoot: (fn: () => void) => () => void;

const globals = globalThis as unknown as {
	game: { system?: unknown; clipboard?: unknown };
	foundry: { utils: { saveDataToFile?: unknown } };
};
const saved = vi.fn((_text: string) => {});
const copied = vi.fn(async (_text: string) => {});
const before = {
	system: globals.game.system,
	clipboard: globals.game.clipboard,
	save: globals.foundry.utils.saveDataToFile,
};

beforeAll(async () => {
	globals.game.system = { version: '0.10.0' };
	globals.game.clipboard = { copyPlainText: copied };
	globals.foundry.utils.saveDataToFile = saved;
	vi.resetModules();
	vi.doMock('../../../support/collectSupportReport.js', () => ({
		collectSupportReport,
		foundryVersion: () => '14.350',
		selectedActor: () => ({ name: 'Aria' }),
		supportWord: (key: string) => key,
	}));
	({ createSupportReportDialogState: createState } = await import(
		'../SupportReportDialogState.svelte.ts'
	));
	({ effect_root: effectRoot } = (await import('svelte/internal/client')) as unknown as {
		effect_root: typeof effectRoot;
	});
});

afterAll(() => {
	globals.game.system = before.system;
	globals.game.clipboard = before.clipboard;
	globals.foundry.utils.saveDataToFile = before.save;
});

function reportWith(actor: SupportReport['actor']): SupportReport {
	return {
		made: '2026-11-15T11:52:00.000Z',
		user: { name: 'Gamemaster', isGM: true },
		foundry: '14.350',
		systemVersion: '0.10.0',
		schema: 90,
		browser: 'Chrome 142 - Windows 11',
		world: { title: 'Sunken Temple', actors: 1, items: 0, scenes: 0 },
		modules: [],
		settings: [],
		errors: [],
		dropped: 0,
		migration: null,
		actor,
	};
}

describe('the Support Report window', () => {
	it('does not send the actor after the checkbox is cleared, while the new report is not ready', async () => {
		let state!: ReturnType<typeof createState>;
		const cleanup = effectRoot(() => {
			state = createState();
		});
		pending.shift()?.(reportWith(null));
		state.setWithActor(true);
		pending.shift()?.(reportWith({ name: 'Aria', type: 'character', json: '{"secret":"Aria"}' }));
		await vi.waitFor(() => expect(state.text).toContain('{"secret":"Aria"}'));

		state.setWithActor(false);
		state.save();
		await state.copy();

		expect(pending).toHaveLength(1);
		expect(saved.mock.calls[0][0]).not.toContain('{"secret":"Aria"}');
		expect(copied.mock.calls[0][0]).not.toContain('{"secret":"Aria"}');
		cleanup();
	});
});
