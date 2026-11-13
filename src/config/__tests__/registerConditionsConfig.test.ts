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
