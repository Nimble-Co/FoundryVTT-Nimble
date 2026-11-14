import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const applyCondition = vi.fn();
let applyCasterConcentration: typeof import('../concentration.js').applyCasterConcentration;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../applyConditionToActor.js', () => ({ default: applyCondition }));
	vi.doMock('../../../settings/automationSettings.js', () => ({
		isRuleAutomationEnabled: () => true,
	}));
	vi.doMock('../../../hooks/conditionImmunityGuard.js', () => ({
		isConditionImmune: () => false,
	}));
	({ applyCasterConcentration } = await import('../concentration.js'));
});

describe('applyCasterConcentration', () => {
	let saved: unknown;
	const caster = { uuid: 'Actor.hero', effects: [] };
	const spell = {
		uuid: 'Actor.hero.Item.winds',
		tags: new Set(['property:concentration']),
		actor: caster,
		system: { activation: { duration: { quantity: 1, type: 'minute' } } },
	};

	beforeEach(() => {
		applyCondition.mockReset().mockResolvedValue({ id: 'conc' });
		saved = (CONFIG as { statusEffects?: unknown }).statusEffects;
		(CONFIG as { statusEffects?: unknown }).statusEffects = [
			{ id: 'concentration', system: { lastsUntil: [] } },
		];
	});

	afterEach(() => {
		(CONFIG as { statusEffects?: unknown }).statusEffects = saved;
	});

	function appliedTime() {
		const [, , options] = applyCondition.mock.calls[0] as [
			unknown,
			unknown,
			{ lastsUntil?: { value: number; units: string }[] },
		];
		return options.lastsUntil?.find((moment) => moment.units);
	}

	it('lasts the Duration of the card it is cast with, which an upcast can raise', async () => {
		const outcome = await applyCasterConcentration(spell, {
			duration: { quantity: 2, type: 'minute' },
		});

		expect(outcome).toBe('applied');
		expect(appliedTime()).toMatchObject({ value: 2, units: 'minutes' });
	});

	it("lasts the item's Duration with no card activation", async () => {
		await applyCasterConcentration(spell);

		expect(appliedTime()).toMatchObject({ value: 1, units: 'minutes' });
	});
});
