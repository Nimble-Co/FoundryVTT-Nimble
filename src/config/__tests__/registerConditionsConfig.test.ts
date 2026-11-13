import { afterEach, describe, expect, it } from 'vitest';
import registerConditionsConfig, {
	registerSpecialStatusEffects,
	STATUS_EFFECT_IDS,
} from '../registerConditionsConfig.js';

describe('registerSpecialStatusEffects', () => {
	const original = CONFIG.specialStatusEffects;

	afterEach(() => {
		CONFIG.specialStatusEffects = original;
	});

	it("gives core's blindness the Blinded condition and keeps the other special statuses", () => {
		CONFIG.specialStatusEffects = {
			DEFEATED: 'dead',
			INVISIBLE: 'invisible',
			BLIND: 'blind',
		} as never;

		registerSpecialStatusEffects();

		expect(CONFIG.specialStatusEffects).toEqual({
			DEFEATED: 'dead',
			INVISIBLE: 'invisible',
			BLIND: STATUS_EFFECT_IDS.blinded,
		});
	});
});

describe('conditionLastsUntil', () => {
	const event = (name: string, who: string | null) => ({
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who,
		event: name,
		effectName: '',
	});

	it("Despair lasts until the holder's next attack, or combat ends", () => {
		expect(registerConditionsConfig().conditionLastsUntil.despair).toEqual([
			event('attack', 'holder'),
			event('combatEnd', null),
		]);
	});

	it.each(['dazed', 'slowed'])("%s lasts until the end of the holder's next turn", (id) => {
		expect(registerConditionsConfig().conditionLastsUntil[id]).toEqual([
			{
				kind: 'turn',
				boundary: 'end',
				clock: 'holder',
				span: 'nextTurn',
				value: null,
				units: null,
				who: null,
				event: null,
				effectName: '',
			},
		]);
	});

	it('Grappled lasts until its source drops to 0 HP, dies or gains Incapacitated', () => {
		expect(registerConditionsConfig().conditionLastsUntil.grappled).toEqual([
			event('zeroHp', 'source'),
			event('die', 'source'),
			{ ...event('gain', 'source'), effectName: 'incapacitated' },
		]);
	});

	it('Confused has no default Lasts Until', () => {
		expect(registerConditionsConfig().conditionLastsUntil.confused).toBeUndefined();
	});

	it('Concentrating lasts until the holder drops to 0 HP or gains Incapacitated', () => {
		expect(registerConditionsConfig().conditionLastsUntil.concentration).toEqual([
			event('zeroHp', 'holder'),
			{ ...event('gain', 'holder'), effectName: 'incapacitated' },
		]);
	});
});

describe('conditionNegativeConditions', () => {
	const negative = registerConditionsConfig().conditionNegativeConditions;

	it('holds the conditions that harm their holder, Grappled and Swallowed too', () => {
		for (const id of ['blinded', 'dazed', 'poisoned', 'grappled', 'swallowed', 'charged']) {
			expect(negative.has(id)).toBe(true);
		}
	});

	it('leaves out the states the system sets and the conditions that help or do nothing', () => {
		for (const id of [
			'wounded',
			'dying',
			'dead',
			'bloodied',
			'lastStand',
			'concentration',
			'invisible',
			'riding',
			'latched',
		]) {
			expect(negative.has(id)).toBe(false);
		}
	});
});

describe('conditionCountsAs', () => {
	const { conditionCountsAs, conditionAliasedConditions } = registerConditionsConfig();

	it('reads one way: Stunned counts as Incapacitated, and Incapacitated counts as nothing', () => {
		expect(conditionCountsAs.stunned).toContain('incapacitated');
		expect(conditionCountsAs).not.toHaveProperty('incapacitated');
	});

	it('keeps every other link of the aliased conditions, Grappled and Restrained both ways', () => {
		expect(conditionCountsAs.grappled).toEqual(['restrained']);
		expect(conditionCountsAs.restrained).toEqual(['grappled']);
		expect(conditionCountsAs.paralyzed).toEqual(conditionAliasedConditions.paralyzed);
	});
});
