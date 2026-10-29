import { describe, expect, it } from 'vitest';
import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { populateDicePoolTags } from '../dicePoolTags.js';

function collect(pools: unknown): Set<string> {
	const tags = new Set<string>();
	populateDicePoolTags(
		{ flags: { [DicePoolRuleConfig.flagScope]: { [DicePoolRuleConfig.flagKey]: pools } } },
		tags,
	);
	return tags;
}

describe('populateDicePoolTags', () => {
	it('emits self:pool:<identifier> only while the pool has a die', () => {
		expect(collect({ judgment: { identifier: 'judgment', faces: [6], max: 2 } })).toContain(
			'self:pool:judgment',
		);
		expect(collect({ judgment: { identifier: 'judgment', faces: [], max: 2 } })).not.toContain(
			'self:pool:judgment',
		);
	});

	it('keeps the count tags', () => {
		const tags = collect({ judgment: { identifier: 'judgment', faces: [6, 4], max: 2 } });
		expect(tags).toContain('self:judgmentDicePool:2');
		expect(tags).toContain('self:judgmentDiceMax');
	});
});
