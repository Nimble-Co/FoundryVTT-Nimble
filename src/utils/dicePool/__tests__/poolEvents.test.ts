import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { poolRollEvent } from '../poolEvents.js';

const en = JSON.parse(readFileSync(path.resolve(process.cwd(), 'public/lang/en.json'), 'utf-8'));
const rage = { name: 'Rage', img: 'rage.webp' };

describe('the line of a pool roll', () => {
	it('says the dice were rolled for the pool, true also when a full pool kept none', () => {
		const event = poolRollEvent(rage, 'Fury Dice', [4]);

		expect(event.text.key).toBe('NIMBLE.chat.events.poolRoll.text');
		expect(en.NIMBLE.chat.events.poolRoll.text).toBe('Rolled {faces} for {pool}');
	});

	it('names the item as the cause when no die was raised', () => {
		expect(poolRollEvent(rage, 'Fury Dice', [4]).cause).toEqual({
			key: 'NIMBLE.chat.events.cause.source',
			data: { source: 'Rage' },
		});
	});

	it('shows the faces after the raise, and the dice that came up below the lowest face', () => {
		const event = poolRollEvent(rage, 'Fury Dice', [3, 5], [{ rolled: 1, face: 3 }]);

		expect(event.text.data).toEqual({ pool: 'Fury Dice', faces: '3, 5' });
		expect(event.cause).toEqual({
			key: 'NIMBLE.dicePoolTracker.raisedToFloor',
			data: { flavor: 'Rage', rolled: '1', face: '3' },
		});
	});
});
