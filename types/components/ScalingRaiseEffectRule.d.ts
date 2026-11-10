import type { ApplyEffectRuleNumbers } from '../../src/utils/spell/effectRuleNumbers.ts';
import type { ScalingDelta } from '../spellScaling.d.ts';

export type RaiseField = 'targetEffectId' | 'ruleId' | 'ruleField' | 'value';

export interface ScalingRaiseEffectRuleProps {
	delta: ScalingDelta;
	/** The Apply Effect nodes of the item, with the rules and number fields an upcast can raise */
	targets: ApplyEffectRuleNumbers[];
	onUpdate: (field: RaiseField, value: string | number | null) => void;
}
