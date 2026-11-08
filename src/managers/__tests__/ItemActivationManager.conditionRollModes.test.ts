import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import { ItemActivationManager, testDependencies } from '../ItemActivationManager.js';

const dialogState = { result: undefined as unknown };

const MockDamageRoll = vi.fn(function DamageRollMock() {
	return {
		evaluate: vi.fn().mockResolvedValue(undefined),
		toJSON: vi.fn().mockReturnValue({ total: 4 }),
		primaryDie: { faces: 8 },
	};
});

const MockDialog = vi.fn(function DialogMock() {
	return {
		render: vi.fn().mockResolvedValue(undefined),
		promise: Promise.resolve(dialogState.result),
	};
});

function creature(name: string, conditions: string[] = []) {
	return {
		name,
		uuid: `Actor.${name}`,
		getDomain: () => new Set(conditions.map((condition) => `self:${condition}`)),
		getTargetDomain: () => new Set(conditions.map((condition) => `target:${condition}`)),
	};
}

function attacker(conditions: string[] = []) {
	return {
		...creature('Kael', conditions),
		token: { uuid: 'Token.kael' },
		getRollData: vi.fn(() => ({})),
		getFlag: vi.fn(() => undefined),
		toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
		system: { savingThrows: {} },
	};
}

function target(name: string, conditions: string[] = []) {
	return { actor: creature(name, conditions), document: { uuid: `Token.${name}` } };
}

function setTargets(...targets: Array<ReturnType<typeof target>>) {
	const globals = globalThis as unknown as Record<string, any>;
	globals.game.user.targets = targets;
	globals.canvas = { tokens: { placeables: [] }, scene: { tokens: [] } };
}

const ATTACK: EffectNode = {
	id: 'damage-1',
	type: 'damage',
	canCrit: true,
	canMiss: true,
	formula: '1d8',
} as EffectNode;

async function attack(
	actor: ReturnType<typeof attacker>,
	options: Record<string, unknown> = { fastForward: true },
	activation: Record<string, unknown> = { targets: { attackType: 'reach' } },
) {
	const item = {
		type: 'weapon',
		name: 'Spear',
		actor,
		system: { activation: { effects: [], ...activation } },
	};
	const manager = new ItemActivationManager(
		item as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
		options,
	);
	manager.activationData = { effects: [{ ...ATTACK }], ...activation };
	await manager.getData();
	const rollOptions = lastRollOptions();
	return { manager, rollOptions };
}

const lastRollOptions = () =>
	(MockDamageRoll.mock.calls.at(-1) as unknown[] | undefined)?.[2] as Record<string, any>;

const used = (rollOptions: Record<string, any>) =>
	(rollOptions.conditionRollModes ?? []).map(
		(line: { side: string; condition: string; step: number }) =>
			`${line.side}:${line.condition}:${line.step}`,
	);

describe('ItemActivationManager: conditions that change the roll mode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dialogState.result = undefined;
		Object.assign(testDependencies, {
			DamageRoll: MockDamageRoll,
			reconstructEffectsTree: (effects: EffectNode[]) => effects,
			ItemActivationConfigDialog: MockDialog,
			SpellUpcastDialog: MockDialog,
		});
	});

	afterEach(() => {
		setTargets();
		delete (globalThis as unknown as Record<string, unknown>).canvas;
	});

	it('with no window, adds each condition as its own roll mode source and names it', async () => {
		setTargets(target('Goblin', ['blinded', 'prone']));

		const { rollOptions } = await attack(attacker(['poisoned']), {
			fastForward: true,
			rollMode: -1,
		});

		expect(rollOptions.rollModeSources).toEqual([-1, -1, 1, 1]);
		expect(used(rollOptions)).toEqual(['self:poisoned:-1', 'target:blinded:1', 'target:prone:1']);
	});

	it('uses the ticks of the window, and does not read the conditions again', async () => {
		setTargets(target('Goblin', ['blinded', 'prone']));
		dialogState.result = {
			rollMode: 0,
			conditionRollModes: [
				{
					key: 'target:blinded',
					condition: 'blinded',
					side: 'target',
					step: 1,
					on: true,
					name: 'Goblin',
				},
			],
		};

		const { rollOptions } = await attack(attacker(), {});

		expect(rollOptions.rollModeSources).toEqual([0, 1]);
		expect(used(rollOptions)).toEqual(['target:blinded:1']);
	});

	it('reads no target condition on a Multi-target Attack or an area, but keeps the roller conditions', async () => {
		setTargets(target('Goblin', ['blinded']), target('Ogre', ['blinded']));
		const multi = await attack(attacker(['prone']));
		expect(used(multi.rollOptions)).toEqual(['self:prone:-1']);

		setTargets(target('Goblin', ['blinded']));
		const area = await attack(attacker(['prone']), undefined, {
			targets: { attackType: 'range' },
			acquireTargetsFromTemplate: true,
			template: { shape: 'circle' },
		});
		expect(used(area.rollOptions)).toEqual(['self:prone:-1']);
	});

	it('changes nothing on a roll that is not an attack', async () => {
		setTargets(target('Goblin', ['blinded']));

		const actor = attacker(['poisoned']);
		const item = { type: 'object', name: 'Bomb', actor, system: { activation: { effects: [] } } };
		const manager = new ItemActivationManager(
			item as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
			{ fastForward: true },
		);
		manager.activationData = {
			effects: [{ ...ATTACK, canCrit: false, canMiss: false } as EffectNode],
			targets: {},
		};
		await manager.getData();
		const rollOptions = lastRollOptions();

		expect(rollOptions.rollModeSources).toBeUndefined();
		expect(rollOptions.conditionRollModes).toBeUndefined();
	});

	it('takes the condition steps out with all other disadvantage', async () => {
		setTargets(target('Goblin', ['blinded']));

		const { rollOptions } = await attack(attacker(['poisoned']), {
			fastForward: true,
			ignoreDisadvantage: true,
		});

		expect(rollOptions.rollModeSources).toEqual([1]);
	});

	describe('Despair', () => {
		it('ends after the attack that used it, once the use is allowed', async () => {
			setTargets(target('Goblin'));
			const actor = attacker(['despair']);

			const { manager, rollOptions } = await attack(actor);
			expect(used(rollOptions)).toEqual(['self:despair:-1']);
			expect(actor.toggleStatusEffect).not.toHaveBeenCalled();

			await manager.applyDeferredPoolNodes();
			expect(actor.toggleStatusEffect).toHaveBeenCalledWith('despair', { active: false });
		});

		it('stays when the player took its tick off', async () => {
			setTargets(target('Goblin'));
			const actor = attacker(['despair']);
			dialogState.result = { rollMode: 0, conditionRollModes: [] };

			const { manager } = await attack(actor, {});
			await manager.applyDeferredPoolNodes();

			expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
		});
	});
});
