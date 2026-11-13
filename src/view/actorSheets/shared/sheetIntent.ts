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
	| { kind: 'openEffect'; effectId: string; itemId: string | null }
	| { kind: 'removeEffect'; effectId: string; itemId: string | null }
	| { kind: 'escape'; effectId: string }
	| { kind: 'setCondition'; conditionId: string; active: boolean }
	| { kind: 'setFlag'; flag: Flag; value: boolean | number }
	| { kind: 'setCurrency'; coin: string; value: number };

/** Typed by the union, so a kind added to `SheetIntent` does not compile until it is here. */
const SHEET_INTENT_KINDS: Record<SheetIntent['kind'], true> = {
	setHp: true,
	setTempHp: true,
	rename: true,
	changePortrait: true,
	deleteItem: true,
	setPoolCharges: true,
	rollSave: true,
	activate: true,
	openItem: true,
	endEffect: true,
	openEffect: true,
	removeEffect: true,
	escape: true,
	setCondition: true,
	setFlag: true,
	setCurrency: true,
};

/** Whether the shared perform acts on this intent. */
export function isSheetIntent<T extends { kind: string }>(
	intent: T,
): intent is Extract<T, { kind: SheetIntent['kind'] }> {
	return Object.hasOwn(SHEET_INTENT_KINDS, intent.kind);
}
