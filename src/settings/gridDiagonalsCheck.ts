import { SYSTEM_ID } from '#system';
import localize from '../utils/localize.js';

export const GRID_DIAGONALS_KEPT_SETTING_KEY = 'gridDiagonalsKept';

const TEXT = 'NIMBLE.settings.gridDiagonalsCheck';

const CORE_LABELS: Record<number, string> = {
	0: 'SETTINGS.GridDiagonalsEquidistant',
	1: 'SETTINGS.GridDiagonalsExact',
	2: 'SETTINGS.GridDiagonalsApproximate',
	3: 'SETTINGS.GridDiagonalsRectilinear',
	4: 'SETTINGS.GridDiagonalsAlternating1',
	5: 'SETTINGS.GridDiagonalsAlternating2',
	6: 'SETTINGS.GridDiagonalsIllegal',
};

type DiagonalProblem = 'illegal' | 'notInBook';

/**
 * Why a Grid Diagonals value works badly with Nimble ranges, or null. The book
 * lets a table treat diagonals as adjacent, as not adjacent, or every other one
 * as adjacent (Core Rules, Diagonal Spaces).
 */
export function diagonalProblem(value: number): DiagonalProblem | null {
	const { EXACT, APPROXIMATE, ILLEGAL } = CONST.GRID_DIAGONALS;
	if (value === ILLEGAL) return 'illegal';
	if (value === EXACT || value === APPROXIMATE) return 'notInBook';
	return null;
}

export function registerGridDiagonalsKeptSetting(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		GRID_DIAGONALS_KEPT_SETTING_KEY as 'rollMode',
		{
			scope: 'world',
			config: false,
			type: Number,
			default: -1,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

function setting(scope: string, key: string): unknown {
	return game.settings.get(scope as 'core', key as 'rollMode');
}

async function setSetting(scope: string, key: string, value: number): Promise<void> {
	await game.settings.set(scope as 'core', key as 'rollMode', value as never);
}

function coreLabel(value: number): string {
	return game.i18n?.localize?.(CORE_LABELS[value] ?? '') ?? CORE_LABELS[value] ?? String(value);
}

/** Show the GM a popup when Grid Diagonals is set to a value that Nimble ranges handle badly. */
export async function checkGridDiagonals(): Promise<void> {
	if (!game.user?.isGM) return;
	const value = Number(setting('core', 'gridDiagonals'));
	const problem = diagonalProblem(value);
	if (!problem || Number(setting(SYSTEM_ID, GRID_DIAGONALS_KEPT_SETTING_KEY)) === value) return;

	const { EQUIDISTANT, RECTILINEAR } = CONST.GRID_DIAGONALS;
	const use = (action: string, rule: number, isDefault = false) => ({
		action,
		label: localize(`${TEXT}.use`, { value: coreLabel(rule) }),
		default: isDefault,
	});
	const buttons = [
		use('equidistant', EQUIDISTANT, true),
		...(problem === 'illegal' ? [use('rectilinear', RECTILINEAR)] : []),
		{ action: 'keep', label: localize(`${TEXT}.keep`, { value: coreLabel(value) }) },
	];

	const choice = await foundry.applications.api.DialogV2.wait({
		window: { title: localize(`${TEXT}.title`), icon: 'fa-solid fa-border-all' },
		position: { width: 460 },
		content: localize(`${TEXT}.${problem}`, { value: coreLabel(value) }),
		buttons,
		rejectClose: false,
	} as never);

	if (choice === 'keep') {
		await setSetting(SYSTEM_ID, GRID_DIAGONALS_KEPT_SETTING_KEY, value);
		return;
	}
	const rule =
		choice === 'equidistant' ? EQUIDISTANT : choice === 'rectilinear' ? RECTILINEAR : null;
	if (rule === null) return;
	await setSetting('core', 'gridDiagonals', rule);
	foundry.utils.debouncedReload?.();
}

/** Check again when a GM changes Grid Diagonals, before the reload it asks for. */
export function registerGridDiagonalsCheckHooks(): void {
	const onSetting = (setting: { key?: string }) => {
		if (setting?.key !== 'core.gridDiagonals') return;
		checkGridDiagonals().catch((error) => console.error(error));
	};
	Hooks.on('createSetting', onSetting);
	Hooks.on('updateSetting', onSetting);
}
