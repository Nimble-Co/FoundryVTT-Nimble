import { type RerollRuleLike, rollUseOfRule } from './rerollEntries.js';

/** What using a Change This Roll row does. */
type RollChangeKind =
	| 'reroll'
	| 'change'
	| 'crit'
	| 'result'
	| 'effect'
	| 'critDiceSave'
	| 'keepAmount'
	| 'optionWindow';

/** The kind of use of a row's rule. The GM runs the row by this kind alone. */
function rollChangeKindOf(rule: RerollRuleLike): RollChangeKind {
	const use = rollUseOfRule(rule);
	if (use !== 'effect') return use ?? 'reroll';
	const effect = rule.rollEffect;
	if (effect === 'critDiceSave' || effect === 'keepAmount' || effect === 'optionWindow') {
		return effect;
	}
	return 'effect';
}

export { type RollChangeKind, rollChangeKindOf };
