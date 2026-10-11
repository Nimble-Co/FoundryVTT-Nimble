import { describe, expect, it } from 'vitest';
import { prototypeTokenNameFor } from './prototypeTokenNameFor.js';

describe('prototypeTokenNameFor', () => {
	it('follows a rename while the token name still matches the actor name', () => {
		expect(prototypeTokenNameFor({ name: 'Goblin' }, 'New Actor', 'New Actor')).toBe('Goblin');
	});

	it('fills an empty token name', () => {
		expect(prototypeTokenNameFor({ name: 'Goblin' }, 'New Actor', '')).toBe('Goblin');
	});

	it('keeps a token name that was set by hand', () => {
		expect(prototypeTokenNameFor({ name: 'Goblin' }, 'New Actor', 'Hooded Figure')).toBeUndefined();
	});

	it('does nothing when the update has no new name', () => {
		expect(prototypeTokenNameFor({ img: 'a.webp' }, 'Goblin', 'Goblin')).toBeUndefined();
		expect(prototypeTokenNameFor({ name: 'Goblin' }, 'Goblin', 'Goblin')).toBeUndefined();
	});

	it('does not replace a token name given in the same update', () => {
		expect(
			prototypeTokenNameFor(
				{ name: 'Goblin', prototypeToken: { name: 'Hooded Figure' } },
				'New Actor',
				'New Actor',
			),
		).toBeUndefined();
		expect(
			prototypeTokenNameFor(
				{ name: 'Goblin', 'prototypeToken.name': 'Hooded Figure' },
				'New Actor',
				'New Actor',
			),
		).toBeUndefined();
	});
});
