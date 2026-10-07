import { describe, expect, it } from 'vitest';
import { queueMovementOfferWrite } from './queueMovementOfferWrite.js';

describe('queueMovementOfferWrite', () => {
	it('starts a write only after the one queued before it has finished', async () => {
		const order: string[] = [];
		let release: () => void = () => undefined;
		const first = queueMovementOfferWrite(async () => {
			order.push('first starts');
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			order.push('first ends');
		});
		const second = queueMovementOfferWrite(async () => {
			order.push('second starts');
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(order).toEqual(['first starts']);
		release();
		await Promise.all([first, second]);
		expect(order).toEqual(['first starts', 'first ends', 'second starts']);
	});

	it('gives the caller the failure of its write and runs the next one', async () => {
		const failed = queueMovementOfferWrite(async () => {
			throw new Error('no write');
		});
		const next = queueMovementOfferWrite(async () => 'done');
		await expect(failed).rejects.toThrow('no write');
		await expect(next).resolves.toBe('done');
	});
});
