import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY } from '../settings/diceSoNiceSettings.js';
import { PRIMARY_DIE_COLORSET } from './diceSoNiceIntegration.js';
import {
	_resetVWarned,
	getNimbleMods,
	NIMBLE_MODS,
	nimbleCrit,
	nimbleCritVicious,
	nimbleNeutral,
	nimbleVicious,
} from './nimbleDieModifiers.js';

type DieResult = {
	result: number;
	active?: boolean;
	discarded?: boolean;
	exploded?: boolean;
};

interface MockDie {
	results: DieResult[];
	modifiers: string[];
	options?: Record<string, unknown>;
}

function createMockDie(overrides?: Partial<MockDie>): MockDie {
	return {
		results: [],
		modifiers: [],
		...overrides,
	};
}

// ─── nimbleCrit (c modifier) ────────────────────────────────────────

describe('nimbleCrit', () => {
	it('should attach canCrit: true and explosionStyle: standard', () => {
		const die = createMockDie();

		nimbleCrit.call(die, 'c');

		const mods = getNimbleMods(die as unknown as Record<symbol, unknown>);
		expect(mods).toEqual({ canCrit: true, explosionStyle: 'standard' });
	});

	it('should return true', () => {
		const die = createMockDie();

		const result = nimbleCrit.call(die, 'c');

		expect(result).toBe(true);
	});

	it('should add x to modifiers when not already present', () => {
		const die = createMockDie({ modifiers: [] });

		nimbleCrit.call(die, 'c');

		expect(die.modifiers).toContain('x');
	});

	it('should not duplicate x when already present in modifiers', () => {
		const die = createMockDie({ modifiers: ['x'] });

		nimbleCrit.call(die, 'c');

		expect(die.modifiers).toEqual(['x']);
	});

	it('should preserve existing modifiers when adding x', () => {
		const die = createMockDie({ modifiers: ['khn'] });

		nimbleCrit.call(die, 'c');

		expect(die.modifiers).toEqual(['khn', 'x']);
	});
});

// ─── nimbleCritVicious (cv modifier) ────────────────────────────────

describe('nimbleCritVicious', () => {
	it('should attach canCrit: true and explosionStyle: vicious', () => {
		const die = createMockDie();

		nimbleCritVicious.call(die, 'cv');

		const mods = getNimbleMods(die as unknown as Record<symbol, unknown>);
		expect(mods).toEqual({ canCrit: true, explosionStyle: 'vicious' });
	});

	it('should return true', () => {
		const die = createMockDie();

		const result = nimbleCritVicious.call(die, 'cv');

		expect(result).toBe(true);
	});

	it('should NOT add x to modifiers', () => {
		const die = createMockDie({ modifiers: [] });

		nimbleCritVicious.call(die, 'cv');

		expect(die.modifiers).not.toContain('x');
		expect(die.modifiers).toEqual([]);
	});
});

// ─── nimbleVicious (v modifier) ─────────────────────────────────────

describe('nimbleVicious', () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		_resetVWarned();
		vi.restoreAllMocks();
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('should attach canCrit: false and explosionStyle: vicious', () => {
		const die = createMockDie();

		nimbleVicious.call(die, 'v');

		const mods = getNimbleMods(die as unknown as Record<symbol, unknown>);
		expect(mods).toEqual({ canCrit: false, explosionStyle: 'vicious' });
	});

	it('should return true', () => {
		const die = createMockDie();

		const result = nimbleVicious.call(die, 'v');

		expect(result).toBe(true);
	});

	it('should emit console.warn on first call', () => {
		const die = createMockDie();

		nimbleVicious.call(die, 'v');

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledWith("Die modifier 'v' without 'c' has no effect");
	});

	it('should not emit console.warn on second call', () => {
		const die1 = createMockDie();
		const die2 = createMockDie();

		nimbleVicious.call(die1, 'v');
		nimbleVicious.call(die2, 'v');

		expect(warnSpy).toHaveBeenCalledOnce();
	});

	it('should warn again after _resetVWarned is called', () => {
		const die1 = createMockDie();
		const die2 = createMockDie();

		nimbleVicious.call(die1, 'v');
		expect(warnSpy).toHaveBeenCalledOnce();

		_resetVWarned();
		nimbleVicious.call(die2, 'v');

		expect(warnSpy).toHaveBeenCalledTimes(2);
	});
});

// ─── nimbleNeutral (n modifier) ─────────────────────────────────────

describe('nimbleNeutral', () => {
	it('should attach canCrit: false and explosionStyle: none', () => {
		const die = createMockDie();

		nimbleNeutral.call(die, 'n');

		const mods = getNimbleMods(die as unknown as Record<symbol, unknown>);
		expect(mods).toEqual({ canCrit: false, explosionStyle: 'none' });
	});

	it('should return true', () => {
		const die = createMockDie();

		const result = nimbleNeutral.call(die, 'n');

		expect(result).toBe(true);
	});
});

// ─── getNimbleMods ──────────────────────────────────────────────────

describe('getNimbleMods', () => {
	it('should return undefined for a die without metadata', () => {
		const die = createMockDie();

		const mods = getNimbleMods(die as unknown as Record<symbol, unknown>);

		expect(mods).toBeUndefined();
	});

	it('should return metadata after a modifier handler has run', () => {
		const die = createMockDie();
		nimbleCrit.call(die, 'c');

		const mods = getNimbleMods(die as unknown as Record<symbol, unknown>);

		expect(mods).toBeDefined();
		expect(mods!.canCrit).toBe(true);
		expect(mods!.explosionStyle).toBe('standard');
	});

	it('should return the most recently applied metadata when overwritten', () => {
		const die = createMockDie();

		nimbleCrit.call(die, 'c');
		nimbleNeutral.call(die, 'n');

		const mods = getNimbleMods(die as unknown as Record<symbol, unknown>);
		expect(mods).toEqual({ canCrit: false, explosionStyle: 'none' });
	});
});

// ─── NIMBLE_MODS symbol ─────────────────────────────────────────────

describe('NIMBLE_MODS', () => {
	it('should be a symbol', () => {
		expect(typeof NIMBLE_MODS).toBe('symbol');
	});

	it('should have a descriptive name', () => {
		expect(NIMBLE_MODS.description).toBe('nimbleMods');
	});

	it('should be directly readable on the die object after handler runs', () => {
		const die = createMockDie();
		nimbleCrit.call(die, 'c');

		const raw = (die as unknown as Record<symbol, unknown>)[NIMBLE_MODS];
		expect(raw).toEqual({ canCrit: true, explosionStyle: 'standard' });
	});
});

// ─── Primary die appearance (3D dice) ───────────────────────────────

describe('primary die appearance', () => {
	function installSettingsMock(values: Record<string, unknown>) {
		const registeredIds = new Set(Object.keys(values).map((key) => `${SYSTEM_ID}.${key}`));
		(game as unknown as { settings: unknown }).settings = {
			settings: { has: (id: string) => registeredIds.has(id) },
			get: vi.fn((_namespace: string, key: string) => values[key]),
		};
	}

	beforeEach(() => {
		installSettingsMock({});
	});

	it('should tag a die crit-capable through the c modifier', () => {
		const die = createMockDie();

		nimbleCrit.call(die, 'c');

		expect(die.options?.appearance).toEqual({ colorset: PRIMARY_DIE_COLORSET });
		expect(die.options?.dsnDamageTypeManaged).toBe(true);
	});

	it('should tag a die crit-capable through the cv modifier', () => {
		const die = createMockDie();

		nimbleCritVicious.call(die, 'cv');

		expect(die.options?.appearance).toEqual({ colorset: PRIMARY_DIE_COLORSET });
	});

	it('should preserve an appearance already set on the term', () => {
		const die = createMockDie({ options: { appearance: { colorset: 'custom' } } });

		nimbleCrit.call(die, 'c');

		expect(die.options?.appearance).toEqual({ colorset: 'custom' });
	});

	it('should leave options untouched when the user disabled primary die styling', () => {
		installSettingsMock({ [DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY]: false });
		const die = createMockDie();

		nimbleCrit.call(die, 'c');

		expect(die.options).toBeUndefined();
	});
});
