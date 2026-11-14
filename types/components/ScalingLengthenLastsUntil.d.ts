import type { ApplyEffectMomentNumbers } from '../../src/utils/spell/effectMomentNumbers.ts';
import type { ScalingDelta } from '../spellScaling.d.ts';

export type LengthenField = 'targetEffectId' | 'momentIndex' | 'value';

export interface ScalingLengthenLastsUntilProps {
	delta: ScalingDelta;
	/** The Apply Effect nodes of the item whose Lasts Until has a moment with a number */
	targets: ApplyEffectMomentNumbers[];
	onUpdate: (field: LengthenField, value: string | number | null) => void;
}
