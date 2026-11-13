import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const applyAttackerEffects = vi.fn(async (..._args: unknown[]) => undefined);
vi.resetModules();
vi.doMock('#utils/defend/defendRequests.js', () => ({ applyAttackerEffects }));
vi.doMock('#utils/cost/costLedger.js', () => ({ payCost: vi.fn(async () => true) }));
vi.doMock('#utils/chat/cardOperations.js', async (importOriginal) => ({
	...(await importOriginal<object>()),
	mayActFor: () => true,
	rejectCardRequest: vi.fn(),
}));
const { CardDamageBack } = await import('../cardDamageBack.js');
const { damageBack } = await import('../../../models/chat/common.js');
const { damageBackText } = await import('../../../view/chat/components/DamageBackLines.svelte.ts');
type StoredRecord = import('../cardDamageBack.js').DamageBackRecord;

const globals = globalThis as unknown as {
	game: { settings?: unknown; user?: unknown };
	[key: string]: unknown;
};
let attackerByUuid: unknown = null;

interface FieldLike {
	fields?: Record<string, FieldLike>;
	element?: FieldLike;
}

/** What the card keeps when it saves: only the keys its schema has. */
function stored(value: unknown, field: FieldLike): unknown {
	if (Array.isArray(value)) return value.map((each) => stored(each, field.element ?? {}));
	if (!field.fields || value === null || typeof value !== 'object') return value;
	const kept: Record<string, unknown> = {};
	for (const [key, inner] of Object.entries(field.fields)) {
		if (key in (value as object))
			kept[key] = stored((value as Record<string, unknown>)[key], inner);
	}
	return kept;
}

const schema = damageBack().damageBack as unknown as FieldLike;

const flameBarrier = {
	id: 'r1',
	type: 'damageBack',
	label: 'Flame Barrier',
	parentDocument: { id: 'eFlame', uuid: 'Actor.mira.ActiveEffect.eFlame', name: 'Flame Barrier' },
	item: {
		uuid: 'Item.flame',
		name: 'Flame Barrier',
		effects: new Map([['smolder', { name: 'Smoldering', transfer: false }]]),
	},
	amount: 'formula',
	formula: '3',
	damageType: 'fire',
	ignoreArmor: true,
	notOnAllies: false,
	attackerEffectId: 'smolder',
	answersAttack: (attack: { trigger?: string }) => attack.trigger === 'attacked',
};

function setup(rule: Record<string, unknown> = flameBarrier) {
	let records: StoredRecord[] = [];
	const goblin = { uuid: 'Actor.goblin', name: 'Goblin', applyDamage: vi.fn(async () => {}) };
	const host = {
		id: () => 'attack-card',
		attacker: () => goblin,
		attackers: () => [{ actor: goblin, token: { disposition: -1 }, delivery: 'melee' }],
		records: () => records,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			records = stored(changes['system.damageBack'], schema) as StoredRecord[];
		}),
	};
	const holder = {
		actor: { uuid: 'Actor.mira', rules: [rule], getRollData: () => ({}) },
		token: { disposition: 1 },
	};
	return { back: new CardDamageBack(host as never), holder, goblin, written: () => records };
}

let automatic = true;
let settings: unknown;
let user: unknown;

beforeEach(() => {
	vi.clearAllMocks();
	automatic = true;
	settings = globals.game.settings;
	user = globals.game.user;
	globals.game.settings = { get: () => automatic };
	globals.game.user = { ...(user ?? {}), isGM: true };
	globals.fromUuidSync = (uuid: string) =>
		uuid === 'Actor.goblin' ? attackerByUuid : uuid === 'Actor.mira' ? { uuid } : null;
	globals.Roll = class {
		formula: string;
		total = 0;
		constructor(formula: string) {
			this.formula = formula;
		}
		async evaluate() {
			this.total = Number(this.formula);
			return this;
		}
		toJSON() {
			return { formula: this.formula, total: this.total };
		}
	};
});

afterEach(() => {
	globals.game.settings = settings;
	globals.game.user = user;
});

describe('the stored damage back record', () => {
	it('keeps the attacker effect, so the line says the attacker gains it', async () => {
		const { back, holder, written } = setup();
		await back.afterAttack([holder]);
		const [record] = written();
		expect(record?.effect).toEqual({
			itemUuid: 'Item.flame',
			effectId: 'smolder',
			name: 'Smoldering',
		});
		expect(damageBackText(record as StoredRecord)).toBe(
			'Flame Barrier: Goblin takes 3 damage, ignoring armor, and gains Smoldering',
		);
	});

	it('keeps a rule that does not ignore armor, so the line does not say it ignores armor', async () => {
		const { back, holder, written } = setup({ ...flameBarrier, ignoreArmor: false });
		await back.afterAttack([holder]);
		const [record] = written();
		expect(record?.ignoreArmor).toBe(false);
		expect(damageBackText(record as StoredRecord)).toBe(
			'Flame Barrier: Goblin takes 3 damage and gains Smoldering',
		);
	});

	it('gives the stored effect when a click deals a waiting record', async () => {
		automatic = false;
		const { back, holder, goblin, written } = setup();
		attackerByUuid = goblin;
		await back.afterAttack([holder]);
		const [record] = written();
		expect(applyAttackerEffects).not.toHaveBeenCalled();
		await back.resolve(record?.id ?? '', 'deal', 'gm');
		expect(applyAttackerEffects).toHaveBeenCalledWith(
			goblin,
			[{ itemUuid: 'Item.flame', effectId: 'smolder', name: 'Smoldering' }],
			'Actor.mira',
			undefined,
			'attack-card',
		);
	});

	it('keeps its key, so a second read of the stored card makes no second record', async () => {
		const { back, holder, written } = setup();
		await back.afterAttack([holder]);
		await back.afterAttack([holder]);
		expect(written()).toHaveLength(1);
	});
});
