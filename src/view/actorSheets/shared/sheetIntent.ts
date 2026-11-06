import type { SaveKeyType } from '#types/saveKey.js';

/** What both actor sheets ask Foundry to do in the same way. `Flag` is the sheet's own settings flags. */
export type SheetIntent<Flag extends string = string> =
	| { kind: 'setHp'; value: number }
	| { kind: 'setTempHp'; value: number }
	| { kind: 'rename'; name: string }
	| { kind: 'changePortrait'; skipTokenizer: boolean }
	| { kind: 'deleteItem'; itemId: string }
	| { kind: 'setPoolCharges'; poolId: string; value: number }
	| { kind: 'rollSave'; save: SaveKeyType }
	| { kind: 'activate'; itemId: string }
	| { kind: 'openItem'; itemId: string }
	| { kind: 'endEffect'; effectId: string }
	| { kind: 'removeEffect'; effectId: string; itemId: string | null }
	| { kind: 'setCondition'; conditionId: string; active: boolean }
	| { kind: 'setFlag'; flag: Flag; value: boolean | number }
	| { kind: 'setCurrency'; coin: string; value: number };

const SHEET_INTENT_KINDS: ReadonlySet<string> = new Set<SheetIntent['kind']>([
	'setHp',
	'setTempHp',
	'rename',
	'changePortrait',
	'deleteItem',
	'setPoolCharges',
	'rollSave',
	'activate',
	'openItem',
	'endEffect',
	'removeEffect',
	'setCondition',
	'setFlag',
	'setCurrency',
]);

/** Whether the shared perform acts on this intent. */
export function isSheetIntent<T extends { kind: string }>(
	intent: T,
): intent is Extract<T, { kind: SheetIntent['kind'] }> {
	return SHEET_INTENT_KINDS.has(intent.kind);
}
