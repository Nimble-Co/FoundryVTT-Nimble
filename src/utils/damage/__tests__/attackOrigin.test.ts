import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attackOriginName } from '../attackOrigin.ts';

beforeEach(() => {
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) =>
			uuid === 'Actor.boss.Item.strike' ? { name: 'Coordinated Strike!' } : null,
		),
	);
});

afterEach(() => vi.unstubAllGlobals());

describe('attackOriginName', () => {
	it('gives the name of the feature the attack was made through', () => {
		expect(attackOriginName('Actor.boss.Item.strike')).toBe('Coordinated Strike!');
	});

	it('is empty with no uuid, or a feature that is not found', () => {
		expect(attackOriginName(undefined)).toBe('');
		expect(attackOriginName('')).toBe('');
		expect(attackOriginName('Actor.boss.Item.gone')).toBe('');
	});
});
