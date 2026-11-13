import type { NimbleActiveEffect } from '../../src/documents/activeEffect/activeEffect';

export interface EffectSheetProps {
	effect: NimbleActiveEffect;
	sheet: foundry.applications.api.DocumentSheetV2.Any;
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
