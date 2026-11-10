import type { NimbleActiveEffect } from '../../src/documents/activeEffect/activeEffect';
import type EffectSheet from '../../src/documents/sheets/EffectSheet.svelte';

export interface EffectSheetProps {
	effect: NimbleActiveEffect;
	sheet: EffectSheet;
}

/** The props of each tab of the effect window. */
export interface EffectTabProps {
	effect: NimbleActiveEffect;
}

/** One core change of an effect, as `system.changes` keeps it. */
export interface EffectChange {
	key: string;
	type: string;
	value: unknown;
	phase: string;
	priority: number | null;
}
