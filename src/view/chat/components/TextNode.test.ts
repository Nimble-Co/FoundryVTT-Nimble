import { render, screen } from '@testing-library/svelte';
import TextNodeTestHarness from './TextNode.testHarness.svelte';

function createNode(text: string) {
	return {
		id: 'note1',
		type: 'note',
		noteType: 'reminder',
		text,
		parentContext: null,
		parentNode: null,
	};
}

function createMessage(movementContext?: unknown) {
	const message = { id: 'msg1', system: { movementContext }, reactive: null as unknown };
	message.reactive = message;
	return message;
}

function renderNode(text: string, movementContext?: unknown) {
	return render(TextNodeTestHarness, {
		props: { messageDocument: createMessage(movementContext), node: createNode(text) },
	});
}

const stamped = {
	spacesMovedThisTurn: 4,
	targetsSpacesAway: [
		{ tokenUuid: 'Scene.s.Token.a', name: 'Goblin', spaces: 5 },
		{ tokenUuid: 'Scene.s.Token.b', name: 'Ogre', spaces: 1 },
	],
};

describe('TextNode', () => {
	it('renders text with no placeholder as written', () => {
		const { container } = renderNode('Mind the {gap} & <b>edge</b>.', stamped);
		expect(container.querySelector('.nimble-hint')?.textContent?.trim()).toBe(
			'Mind the {gap} & <b>edge</b>.',
		);
	});

	it('fills in the spaces moved this turn stamped on the card', () => {
		renderNode('You moved {spacesMovedThisTurn} spaces this turn.', stamped);
		expect(screen.getByText('You moved 4 spaces this turn.')).toBeTruthy();
	});

	it('says unknown when the card has no spaces moved', () => {
		renderNode('Moved: {spacesMovedThisTurn}', { ...stamped, spacesMovedThisTurn: null });
		expect(screen.getByText('Moved: unknown')).toBeTruthy();
	});

	it('says unknown when the card keeps no movement context', () => {
		renderNode('Moved: {spacesMovedThisTurn}');
		expect(screen.getByText('Moved: unknown')).toBeTruthy();
	});

	it('lists how far each target was', () => {
		renderNode('Distance: {targetsSpacesAway}', stamped);
		expect(screen.getByText('Distance: Goblin: 5 spaces, Ogre: 1 space')).toBeTruthy();
	});

	it('says no target when the card has none', () => {
		renderNode('Distance: {targetsSpacesAway}', { ...stamped, targetsSpacesAway: [] });
		expect(screen.getByText('Distance: no target')).toBeTruthy();
	});

	it('shows a target name as text, never as markup or another placeholder', () => {
		const { container } = renderNode('{targetsSpacesAway} after {spacesMovedThisTurn}', {
			spacesMovedThisTurn: 2,
			targetsSpacesAway: [
				{ tokenUuid: 'Scene.s.Token.a', name: '<img src=x>{spacesMovedThisTurn}', spaces: 3 },
			],
		});
		expect(container.querySelector('img')).toBeNull();
		expect(container.querySelector('.nimble-hint')?.textContent?.trim()).toBe(
			'<img src=x>{spacesMovedThisTurn}: 3 spaces after 2',
		);
	});
});
