/// <reference types="vitest/globals" />

import { initiativeRollLock } from '../../utils/initiativeRollLock.js';
import { NimbleCombatant } from './combatant.svelte.js';

describe('NimbleCombatant', () => {
	it('rejects overwriting an active initiative roll lock with a different request id', async () => {
		const combatant = new NimbleCombatant(
			{
				id: 'combatant-active-lock',
				flags: {
					nimble: {
						initiativeRollLock: {
							requestId: 'request-active',
							userId: 'user-active',
							startedAt: Date.now(),
						},
					},
				},
			} as unknown as Combatant.CreateData,
			{},
		);

		const result = await combatant._preUpdate(
			{
				[initiativeRollLock.path]: {
					requestId: 'request-other',
					userId: 'user-other',
					startedAt: Date.now(),
				},
			},
			{},
			{},
		);

		expect(result).toBe(false);
	});

	it('allows replacing a stale initiative roll lock', async () => {
		const combatant = new NimbleCombatant(
			{
				id: 'combatant-stale-lock',
				flags: {
					nimble: {
						initiativeRollLock: {
							requestId: 'request-stale',
							userId: 'user-stale',
							startedAt: Date.now() - 16_000,
						},
					},
				},
			} as unknown as Combatant.CreateData,
			{},
		);

		const result = await combatant._preUpdate(
			{
				[initiativeRollLock.path]: {
					requestId: 'request-new',
					userId: 'user-new',
					startedAt: Date.now(),
				},
			},
			{},
			{},
		);

		expect(result).toBe(true);
	});

	it('allows clearing an active initiative roll lock', async () => {
		const combatant = new NimbleCombatant(
			{
				id: 'combatant-clear-lock',
				flags: {
					nimble: {
						initiativeRollLock: {
							requestId: 'request-clear',
							userId: 'user-clear',
							startedAt: Date.now(),
						},
					},
				},
			} as unknown as Combatant.CreateData,
			{},
		);

		const result = await combatant._preUpdate(
			{
				[initiativeRollLock.path]: null,
			},
			{},
			{},
		);

		expect(result).toBe(true);
	});
});
