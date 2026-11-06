import { describe, expect, it } from 'vitest';
import { type RerollRuleLike, rollChangeKindOf } from '../rerollEntries.js';

describe('rollChangeKindOf', () => {
	it.each<[RerollRuleLike, string]>([
		[{ type: 'reroll' }, 'reroll'],
		[{ type: 'changeDie' }, 'change'],
		[{ type: 'makeCrit' }, 'crit'],
		[{ type: 'attackOutcome' }, 'crit'],
		[{ type: 'changeResult' }, 'result'],
		[{ type: 'critDice', rollEffect: 'critDice' }, 'effect'],
		[{ type: 'offerAttackBonus', rollEffect: 'offerBonus' }, 'effect'],
		[{ type: 'attackOutcome', rollEffect: 'critD20' }, 'effect'],
		[{ type: 'critDiceSave', rollEffect: 'critDiceSave' }, 'critDiceSave'],
		[{ type: 'keepAmount', rollEffect: 'keepAmount' }, 'keepAmount'],
		[{ type: 'optionWindow', rollEffect: 'optionWindow' }, 'optionWindow'],
	])('reads %o as %s', (rule, kind) => {
		expect(rollChangeKindOf(rule)).toBe(kind);
	});
});
