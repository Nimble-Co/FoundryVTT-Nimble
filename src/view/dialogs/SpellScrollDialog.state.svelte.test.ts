import { render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import SpellScrollDialogStateHarness from '../../../tests/harnesses/SpellScrollDialogStateHarness.svelte';
import type {
	SpellScrollCandidate,
	SpellScrollDialogProps,
} from '../../../types/components/SpellScrollDialog.d.ts';
import type { createSpellScrollDialogState } from './SpellScrollDialog.state.svelte.ts';

type DialogState = ReturnType<typeof createSpellScrollDialogState>;

interface Snapshot {
	destination: 'spellList' | 'scroll';
	subNavigation: string[];
	visibleCandidates: string[];
	selectedVisibleUuid: string | null;
	expandedUuid: string | null;
	expandedDescription: string | null;
	isSubmitDisabled: boolean;
	submitLabel: string;
	submitIcon: string;
	manaCostLabel: string;
	upcastLabel: string;
	arcanaLabel: string;
}

function createCandidate(name: string, school: string, uuid: string): SpellScrollCandidate {
	return {
		name,
		school,
		uuid,
		img: '',
		tier: 3,
		isUtility: false,
		classes: [],
		activationSummary: '1 Action',
	};
}

const FIREBALL = createCandidate('Fireball', 'fire', 'Item.fireball');
const FIRE_DART = createCandidate('Fire Dart', 'fire', 'Item.firedart');
const LIGHTNING_BOLT = createCandidate('Lightning Bolt', 'lightning', 'Item.lightningbolt');

/**
 * Renders the state factory inside a component so the runes have a real reactive
 * context, and returns both a live snapshot reader and the state object to drive.
 */
function setup(overrides: Partial<SpellScrollDialogProps> = {}) {
	const submit = vi.fn().mockResolvedValue(undefined);
	let state!: DialogState;

	const props: SpellScrollDialogProps = {
		dialog: { submit },
		mode: 'chooser',
		actorName: 'Modrisse',
		...overrides,
	};

	const { container } = render(SpellScrollDialogStateHarness, {
		props: {
			props,
			onready: (created: DialogState) => {
				state = created;
			},
		},
	});

	/**
	 * Reads the derived values back out of the rendered DOM, so each assertion
	 * proves the value actually reached a template rather than only that the getter
	 * returns something. Svelte batches DOM writes, hence the explicit flush.
	 */
	function read(): Snapshot {
		flushSync();
		const node = container.querySelector('[data-testid="snapshot"]');
		return JSON.parse(node?.textContent ?? 'null') as Snapshot;
	}

	return {
		read,
		submit,
		get state() {
			return state;
		},
	};
}

describe('createSpellScrollDialogState', () => {
	describe('visibleCandidates', () => {
		it('shows every candidate before the player filters anything', async () => {
			const { read } = setup({
				mode: 'picker',
				candidates: [FIREBALL, FIRE_DART, LIGHTNING_BOLT],
			});

			expect(read().visibleCandidates).toEqual(['Fireball', 'Fire Dart', 'Lightning Bolt']);
		});

		it('narrows to the school of the selected tab', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			harness.state.currentTab = { icon: '', name: 'lightning', tooltip: '' };

			expect(harness.read().visibleCandidates).toEqual(['Lightning Bolt']);
		});

		it('matches the search term case-insensitively and ignores surrounding space', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			harness.state.searchTerm = '  LIGHTNING ';

			expect(harness.read().visibleCandidates).toEqual(['Lightning Bolt']);
		});

		it('applies the tab and the search term together, not either alone', async () => {
			const harness = setup({
				mode: 'picker',
				candidates: [FIREBALL, FIRE_DART, LIGHTNING_BOLT],
			});

			harness.state.currentTab = { icon: '', name: 'fire', tooltip: '' };
			harness.state.searchTerm = 'dart';

			expect(harness.read().visibleCandidates).toEqual(['Fire Dart']);
		});
	});

	describe('selectedVisibleUuid', () => {
		it('holds the spell the player picked', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			harness.state.selectSpell('Item.fireball');

			expect(harness.read().selectedVisibleUuid).toBe('Item.fireball');
		});

		// Inscribe must never commit a spell the filter has taken off the screen.
		it('drops a selection that the school tab hides', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			harness.state.selectSpell('Item.fireball');
			harness.state.currentTab = { icon: '', name: 'lightning', tooltip: '' };

			expect(harness.read().selectedVisibleUuid).toBeNull();
		});

		it('drops a selection that the search term hides', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			harness.state.selectSpell('Item.fireball');
			harness.state.searchTerm = 'lightning';

			expect(harness.read().selectedVisibleUuid).toBeNull();
		});

		it('restores the selection when the filter that hid it is cleared', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			harness.state.selectSpell('Item.fireball');
			harness.state.searchTerm = 'lightning';
			harness.state.searchTerm = '';

			expect(harness.read().selectedVisibleUuid).toBe('Item.fireball');
		});
	});

	describe('subNavigation', () => {
		it('leads with the all-schools tab', async () => {
			const { read } = setup({ mode: 'picker', candidates: [FIREBALL] });

			expect(read().subNavigation[0]).toBe('all');
		});

		it('offers a tab only for the schools the candidates actually cover', async () => {
			const { read } = setup({ mode: 'picker', candidates: [FIREBALL, FIRE_DART] });

			expect(read().subNavigation).toEqual(['all', 'fire']);
		});

		it('is the lone all tab when there are no candidates', async () => {
			const { read } = setup({ mode: 'picker', candidates: [] });

			expect(read().subNavigation).toEqual(['all']);
		});
	});

	describe('expandedUuid', () => {
		it('opens a row, and closes it when the same row is toggled again', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			await harness.state.toggleExpanded('Item.fireball');
			expect(harness.read().expandedUuid).toBe('Item.fireball');

			await harness.state.toggleExpanded('Item.fireball');
			expect(harness.read().expandedUuid).toBeNull();
		});

		it('moves to the newly opened row rather than opening two at once', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL, LIGHTNING_BOLT] });

			await harness.state.toggleExpanded('Item.fireball');
			await harness.state.toggleExpanded('Item.lightningbolt');

			expect(harness.read().expandedUuid).toBe('Item.lightningbolt');
		});
	});

	// Descriptions are the one field the pack index cannot supply, so they are
	// fetched per opened row rather than for every candidate on the tier.
	describe('candidate descriptions', () => {
		const FIREBALL_TEXT = '<p>A ball of fire.</p>';

		function setupPicker(loadDescription: (uuid: string) => Promise<string>) {
			return setup({
				mode: 'picker',
				candidates: [FIREBALL, LIGHTNING_BOLT],
				loadDescription,
			});
		}

		it('has no description for a row nobody opened', async () => {
			const loadDescription = vi.fn().mockResolvedValue(FIREBALL_TEXT);
			const harness = setupPicker(loadDescription);

			harness.read();

			expect(loadDescription).not.toHaveBeenCalled();
			expect(harness.state.descriptionFor('Item.fireball')).toBeNull();
		});

		it('reads null while the opened row is still loading, then the fetched text', async () => {
			const loadDescription = vi.fn().mockResolvedValue(FIREBALL_TEXT);
			const harness = setupPicker(loadDescription);

			const opened = harness.state.toggleExpanded('Item.fireball');
			expect(harness.read().expandedDescription).toBeNull();

			await opened;

			expect(harness.read().expandedDescription).toBe(FIREBALL_TEXT);
			expect(loadDescription).toHaveBeenCalledWith('Item.fireball');
		});

		it('fetches a row once, however often it is reopened', async () => {
			const loadDescription = vi.fn().mockResolvedValue(FIREBALL_TEXT);
			const harness = setupPicker(loadDescription);

			await harness.state.toggleExpanded('Item.fireball');
			await harness.state.toggleExpanded('Item.fireball');
			await harness.state.toggleExpanded('Item.fireball');

			expect(loadDescription).toHaveBeenCalledTimes(1);
			expect(harness.read().expandedDescription).toBe(FIREBALL_TEXT);
		});

		it('fetches only the rows that were opened', async () => {
			const loadDescription = vi.fn().mockResolvedValue(FIREBALL_TEXT);
			const harness = setupPicker(loadDescription);

			await harness.state.toggleExpanded('Item.fireball');

			expect(loadDescription).toHaveBeenCalledTimes(1);
			expect(harness.state.descriptionFor('Item.lightningbolt')).toBeNull();
		});
	});

	describe('the submit action', () => {
		it('is disabled in picker mode until a visible spell is selected', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL] });

			expect(harness.read().isSubmitDisabled).toBe(true);

			harness.state.selectSpell('Item.fireball');

			expect(harness.read().isSubmitDisabled).toBe(false);
		});

		it('is never disabled in chooser mode, which always has a default', async () => {
			const { read } = setup({ mode: 'chooser', tier: 3 });

			expect(read().isSubmitDisabled).toBe(false);
		});

		it('sends the chosen spell in picker mode', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL] });

			harness.state.selectSpell('Item.fireball');
			harness.read();
			harness.state.submit();

			expect(harness.submit).toHaveBeenCalledWith({
				destination: 'scroll',
				spellUuid: 'Item.fireball',
			});
		});

		it('does nothing while disabled, so Enter cannot commit an empty picker', async () => {
			const harness = setup({ mode: 'picker', candidates: [FIREBALL] });

			harness.read();
			harness.state.submit();

			expect(harness.submit).not.toHaveBeenCalled();
		});

		it('sends the spell list by default in chooser mode', async () => {
			const harness = setup({ mode: 'chooser', tier: 3 });

			harness.state.submit();

			expect(harness.submit).toHaveBeenCalledWith({ destination: 'spellList' });
		});

		it('sends the scroll once the player switches the destination', async () => {
			const harness = setup({ mode: 'chooser', tier: 3 });

			harness.state.destination = 'scroll';
			harness.state.submit();

			expect(harness.submit).toHaveBeenCalledWith({ destination: 'scroll' });
		});
	});

	describe('the submit button', () => {
		it('names the inventory as the destination when the scroll is chosen', async () => {
			const harness = setup({ mode: 'chooser', tier: 3 });

			harness.state.destination = 'scroll';
			const snapshot = harness.read();

			expect(snapshot.submitLabel).toBe('Add to inventory');
			expect(snapshot.submitIcon).toBe('fa-scroll');
		});

		it('names the spell list as the destination otherwise', async () => {
			const snapshot = setup({ mode: 'chooser', tier: 3 }).read();

			expect(snapshot.submitLabel).toBe('Add to spell list');
			expect(snapshot.submitIcon).toBe('fa-wand-sparkles');
		});

		it('reads Inscribe in picker mode, where there is only one outcome', async () => {
			const snapshot = setup({ mode: 'picker', candidates: [FIREBALL] }).read();

			expect(snapshot.submitLabel).toBe('Inscribe and add to inventory');
			expect(snapshot.submitIcon).toBe('fa-scroll');
		});
	});

	describe('the chooser facts', () => {
		// Mana cost is the spell's tier, and cantrips are free.
		it('quotes the tier as the mana cost', async () => {
			expect(setup({ mode: 'chooser', tier: 3 }).read().manaCostLabel).toContain('3');
		});

		it('says a cantrip costs nothing rather than quoting 0 mana', async () => {
			const label = setup({ mode: 'chooser', tier: 0 }).read().manaCostLabel;

			expect(label).not.toContain('0');
		});

		it('offers upcasting up to the highest tier the actor has unlocked', async () => {
			const label = setup({ mode: 'chooser', tier: 3, highestUnlockedSpellTier: 5 }).read()
				.upcastLabel;

			expect(label).toContain('5');
		});

		it('says upcasting is unavailable when the actor has unlocked no higher tier', async () => {
			const label = setup({ mode: 'chooser', tier: 3, highestUnlockedSpellTier: 3 }).read()
				.upcastLabel;

			expect(label).not.toContain('5');
		});

		it('asks for an Arcana check when the actor knows nothing of the school', async () => {
			const label = setup({ mode: 'chooser', school: 'fire', knowsSchool: false }).read()
				.arcanaLabel;

			expect(label).toContain('Modrisse');
		});

		it('waives the Arcana check when the actor already knows the school', async () => {
			const knows = setup({ mode: 'chooser', school: 'fire', knowsSchool: true }).read()
				.arcanaLabel;
			const doesNot = setup({ mode: 'chooser', school: 'fire', knowsSchool: false }).read()
				.arcanaLabel;

			expect(knows).not.toBe(doesNot);
		});
	});
});
