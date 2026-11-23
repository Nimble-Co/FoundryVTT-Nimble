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
	return { rules: [{ type: 'halfDamageOnKill', reach, disabled: false }] };
}

describe('offerHalfDamageOnKill', () => {
	beforeEach(() => {
		dialogApi().wait = vi.fn();
	});

	it('deals half the roll, rounded down, to a creature within reach', async () => {
		const [killed, near, far] = scene([
			{ id: 'killed', x: 0, hp: 0 },
			{ id: 'near', x: 200, hp: 12 },
			{ id: 'far', x: 1000, hp: 12 },
		]);
		dialog().mockResolvedValue('token:near');
		const deal = vi.fn().mockResolvedValue(undefined);

		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			rolled: 9,
			deal,
		});

		const buttons = dialog().mock.calls[0][0].buttons.map(
			(button: { action: string }) => button.action,
		);
		expect(buttons).toEqual(['token:near', 'decline']);
		expect(deal).toHaveBeenCalledWith(near.actor, 4);
		expect(deal).not.toHaveBeenCalledWith(far.actor, expect.anything());
	});

	it('deals nothing when the applier declines', async () => {
		const [killed, near] = scene([
			{ id: 'killed', x: 0, hp: 0 },
			{ id: 'near', x: 200, hp: 12 },
		]);
		dialog().mockResolvedValue('decline');
		const deal = vi.fn().mockResolvedValue(undefined);

		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			rolled: 8,
			deal,
		});

		expect(deal).not.toHaveBeenCalled();
		expect(near.actor.applyDamage).not.toHaveBeenCalled();
	});

	it('offers nothing when nobody is in reach, the half is 0, or the item has no rule', async () => {
		const [killed, far] = scene([
			{ id: 'killed', x: 0, hp: 0 },
			{ id: 'far', x: 1000, hp: 12 },
		]);
		const deal = vi.fn().mockResolvedValue(undefined);

		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			rolled: 9,
			deal,
		});
		await offerHalfDamageOnKill({
			sourceItem: rule(),
			killedToken: killed,
			rolled: 1,
			deal,
		});
		await offerHalfDamageOnKill({
			sourceItem: { rules: [] },
			killedToken: killed,
			rolled: 9,
			deal,
		});

		expect(dialog()).not.toHaveBeenCalled();
		expect(deal).not.toHaveBeenCalled();
		expect(far.actor.applyDamage).not.toHaveBeenCalled();
	});
});
