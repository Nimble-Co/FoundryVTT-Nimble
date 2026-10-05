import { describe, expect, it } from 'vitest';
import { cycleOfferedDragAction } from './cycleOfferedDragAction.js';

const actions = ['walk', 'fly', 'swim'];

function presses(count: number, reverse: boolean, from: string | null = null) {
	const seen: (string | null)[] = [];
	let current = from;
	for (let press = 0; press < count; press++) {
		current = cycleOfferedDragAction(actions, current, reverse);
		seen.push(current);
	}
	return seen;
}

describe('cycleOfferedDragAction', () => {
	it('goes from the offer through each action and back to the offer', () => {
		expect(presses(5, false)).toEqual(['walk', 'fly', 'swim', null, 'walk']);
	});

	it('goes the other way round the same ring in reverse', () => {
		expect(presses(5, true)).toEqual(['swim', 'fly', 'walk', null, 'swim']);
	});

	it('counts an action that is not in the ring as the offer', () => {
		expect(cycleOfferedDragAction(actions, 'crawl', false)).toBe('walk');
		expect(cycleOfferedDragAction(actions, 'crawl', true)).toBe('swim');
	});

	it('stays on the offer when there is no action to go to', () => {
		expect(cycleOfferedDragAction([], null, false)).toBeNull();
		expect(cycleOfferedDragAction([], null, true)).toBeNull();
	});
});
