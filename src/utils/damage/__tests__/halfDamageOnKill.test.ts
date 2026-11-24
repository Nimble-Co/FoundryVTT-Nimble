import { beforeEach, describe, expect, it, vi } from 'vitest';
import { offerHalfDamageOnKill } from '../halfDamageOnKill.js';

interface Actor {
	id: string;
	name: string;
	system: { attributes: { hp: { value: number } } };
	applyDamage: ReturnType<typeof vi.fn>;
}

interface Token {
	id: string;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	actor: Actor;
	parent: { grid: { isGridless: boolean; size: number }; tokens: Token[] };
}

function actor(id: string, hp: number): Actor {
	return {
		id,
		name: id,
		system: { attributes: { hp: { value: hp } } },
		applyDamage: vi.fn().mockResolvedValue(undefined),
	};
}

function scene(reachActors: { id: string; x: number; hp: number }[]) {
	const grid = { isGridless: true, size: 100 };
	const parent = { grid, tokens: [] as Token[] };
	const tokens = reachActors.map((entry) => ({
		id: entry.id,
		name: entry.id,
		x: entry.x,
		y: 0,
		width: 1,
		height: 1,
		actor: actor(entry.id, entry.hp),
		parent,
	}));
	parent.tokens = tokens;
	return tokens;
}

function dialogApi() {
	return (
		globalThis as unknown as {
			foundry: { applications: { api: { DialogV2: { wait?: ReturnType<typeof vi.fn> } } } };
		}
	).foundry.applications.api.DialogV2;
}

function dialog() {
	const wait = dialogApi().wait;
	if (!wait) throw new Error('DialogV2.wait is not mocked');
	return wait;
}

function rule(reach = 4) {
	return { rules: [{ type: 'halfDamageOnKill', disabled: false, halfOnKill: () => reach }] };
}

describe('offerHalfDamageOnKill', () => {
	beforeEach(() => {
		dialogApi().wait = vi.fn();
	});

	it('deals half the roll, rounded down, to a creature within reach of the attacker', async () => {
		const [hunter, killed, near, nearKilled] = scene([
			{ id: 'hunter', x: 0, hp: 20 },
			{ id: 'killed', x: 500, hp: 0 },
			{ id: 'near', x: 200, hp: 12 },
			{ id: 'nearKilled', x: 700, hp: 12 },
		]);
		dialog().mockResolvedValue('token:near');
		const deal = vi.fn().mockResolvedValue(undefined);

		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			attackerToken: hunter,
			rolled: 9,
			deal,
		});

		const buttons = dialog().mock.calls[0][0].buttons.map(
			(button: { action: string }) => button.action,
		);
		expect(buttons).toEqual(['token:near', 'decline']);
		expect(deal).toHaveBeenCalledWith(near.actor, 4);
		expect(deal).not.toHaveBeenCalledWith(nearKilled.actor, expect.anything());
	});

	it('offers nothing when the attacker has no token on the scene of the kill', async () => {
		const [killed] = scene([
			{ id: 'killed', x: 0, hp: 0 },
			{ id: 'near', x: 200, hp: 12 },
		]);
		const [elsewhere] = scene([{ id: 'hunter', x: 0, hp: 20 }]);
		const deal = vi.fn().mockResolvedValue(undefined);

		for (const attackerToken of [null, elsewhere]) {
			await offerHalfDamageOnKill({
				sourceItem: rule(),
				killedToken: killed,
				attackerToken,
				rolled: 9,
				deal,
			});
		}

		expect(dialog()).not.toHaveBeenCalled();
		expect(deal).not.toHaveBeenCalled();
	});

	it('deals nothing when the applier declines', async () => {
		const [hunter, killed, near] = scene([
			{ id: 'hunter', x: 0, hp: 20 },
			{ id: 'killed', x: 100, hp: 0 },
			{ id: 'near', x: 200, hp: 12 },
		]);
		dialog().mockResolvedValue('decline');
		const deal = vi.fn().mockResolvedValue(undefined);

		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			attackerToken: hunter,
			rolled: 8,
			deal,
		});

		expect(deal).not.toHaveBeenCalled();
		expect(near.actor.applyDamage).not.toHaveBeenCalled();
	});

	it('offers nothing when nobody else is in reach, the half is 0, or the item has no rule', async () => {
		const [hunter, killed, far] = scene([
			{ id: 'hunter', x: 0, hp: 20 },
			{ id: 'killed', x: 100, hp: 0 },
			{ id: 'far', x: 1000, hp: 12 },
		]);
		const deal = vi.fn().mockResolvedValue(undefined);

		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			attackerToken: hunter,
			rolled: 9,
			deal,
		});
		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			attackerToken: hunter,
			rolled: 1,
			deal,
		});
		await offerHalfDamageOnKill({
			sourceItem: { rules: [] },
			killedToken: killed,
			attackerToken: hunter,
			rolled: 9,
			deal,
		});

		expect(dialog()).not.toHaveBeenCalled();
		expect(deal).not.toHaveBeenCalled();
		expect(far.actor.applyDamage).not.toHaveBeenCalled();
	});
});
