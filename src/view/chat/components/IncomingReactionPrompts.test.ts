import { render, screen } from '@testing-library/svelte';
import IncomingReactionPromptsTestHarness from './IncomingReactionPrompts.testHarness.svelte';

interface EntryOptions {
	id?: string;
	kind?: 'forceReroll' | 'redirectToSelf';
	source?: 'baseline' | 'rule';
	label?: string;
	used?: boolean;
}

function createEntry(options: EntryOptions = {}) {
	return {
		id: options.id ?? 'entry-1',
		kind: options.kind ?? 'redirectToSelf',
		source: options.source ?? 'rule',
		actorUuid: 'Actor.protector',
		tokenUuid: 'Scene.s.Token.protector',
		targetTokenUuid: 'Scene.s.Token.victim',
		label: options.label ?? 'Aura of Refuge',
		ruleId: 'rule-1',
		itemUuid: '',
		used: options.used ?? false,
	};
}

function createMessage(entries: ReturnType<typeof createEntry>[]) {
	const message = {
		id: 'message-1',
		system: { incomingReactions: entries },
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

let previousFromUuidSync: unknown;
let previousGameUser: unknown;

beforeEach(() => {
	const g = globalThis as Record<string, any>;
	previousFromUuidSync = g.fromUuidSync;
	previousGameUser = g.game?.user;
	g.fromUuidSync = vi.fn(() => ({ name: 'Sir Brannon', isOwner: true }));
	g.game = g.game ?? {};
	g.game.user = { isGM: true, id: 'gm' };
});

afterEach(() => {
	const g = globalThis as Record<string, any>;
	g.fromUuidSync = previousFromUuidSync;
	if (g.game) g.game.user = previousGameUser;
});

describe('IncomingReactionPrompts', () => {
	it('renders a labeled button for a pending rule-granted redirect entry', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry()]) },
		});

		const button = screen.getByRole('button');
		expect(button.textContent).toContain('Interpose');
		expect(button.textContent).toContain('Aura of Refuge');
		expect(button.textContent).toContain('Sir Brannon');
	});

	it('renders a force reroll button with its granting feature label', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ kind: 'forceReroll', label: "Mountain's Endurance" }),
				]),
			},
		});

		const button = screen.getByRole('button');
		expect(button.textContent).toContain('Force Reroll');
		expect(button.textContent).toContain("Mountain's Endurance");
	});

	it('renders an attribution line instead of a button for used entries', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry({ used: true })]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText(/Sir Brannon/)).toBeTruthy();
	});

	it('renders nothing when there are no entries', () => {
		const { container } = render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([]) },
		});

		expect(container.querySelector('section')).toBeNull();
	});

	it('hides pending buttons from non-owners who are not GMs', () => {
		const g = globalThis as Record<string, any>;
		g.game.user = { isGM: false, id: 'player' };
		g.fromUuidSync = vi.fn(() => ({ name: 'Sir Brannon', isOwner: false }));

		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry()]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
	});
});
