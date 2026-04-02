import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCharacter } from '#documents/actor/character.js';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { getActiveCombatForCurrentScene, registerCombatStateHooks } from '#utils/combatState.js';
import { getHeroicReactionUsageState } from '#utils/getHeroicReactionUsageState.js';
import {
	getHeroicReactionAvailabilityTitle,
	type HeroicReactionKey,
} from '#utils/heroicActions.js';
import localize from '#utils/localize.js';
import { queueCombatantMutationWithFreshDocument } from '#utils/queueCombatantMutationWithFreshDocument.js';
import filterItems from '#view/dataPreparationHelpers/filterItems.js';
import HeroicActionsHelpDialog from '#view/dialogs/HeroicActionsHelpDialog.svelte';

// ============================================================================
// Types
// ============================================================================

interface HeroicAction {
	id: string;
	icon: string;
	labelKey: string;
	descriptionKey: string;
	type: string;
	requiresCombat?: boolean;
}

interface HeroicReaction {
	id: string;
	icon: string;
	labelKey: string;
	descriptionKey: string;
	reactionKey: HeroicReactionKey;
	type: string;
}

interface ActionsData {
	current: number;
	max: number;
}

// ============================================================================
// Action Definitions (Single source of truth for all heroic actions)
// ============================================================================

export const HEROIC_ACTIONS: HeroicAction[] = [
	{
		id: 'attack',
		icon: 'fa-solid fa-sword',
		labelKey: 'NIMBLE.ui.heroicActions.actions.attack.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.attack.description',
		type: 'panel',
	},
	{
		id: 'spell',
		icon: 'fa-solid fa-wand-sparkles',
		labelKey: 'NIMBLE.ui.heroicActions.actions.spell.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.spell.description',
		type: 'panel',
	},
	{
		id: 'move',
		icon: 'fa-solid fa-person-running',
		labelKey: 'NIMBLE.ui.heroicActions.actions.move.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.move.description',
		type: 'panel',
	},
	{
		id: 'assess',
		icon: 'fa-solid fa-eye',
		labelKey: 'NIMBLE.ui.heroicActions.actions.assess.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.assess.description',
		type: 'panel',
	},
];

export const HEROIC_REACTIONS: HeroicReaction[] = [
	{
		id: 'defend',
		icon: 'fa-solid fa-shield',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.defend.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.defend.description',
		reactionKey: 'defend',
		type: 'panel',
	},
	{
		id: 'interpose',
		icon: 'fa-solid fa-people-arrows',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.interpose.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.interpose.description',
		reactionKey: 'interpose',
		type: 'panel',
	},
	{
		id: 'opportunity',
		icon: 'fa-solid fa-bullseye',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.opportunity.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.opportunity.description',
		reactionKey: 'opportunityAttack',
		type: 'panel',
	},
	{
		id: 'help',
		icon: 'fa-solid fa-handshake-angle',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.help.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.help.description',
		reactionKey: 'help',
		type: 'panel',
	},
];

type HeroicReactionUsageState = ReturnType<typeof getHeroicReactionUsageState>;
type HeroicReactionId = (typeof HEROIC_REACTIONS)[number]['id'];
type ReactionUsageStateMap = Record<HeroicReactionId, HeroicReactionUsageState>;

type CombatWithHeroicReactionUse = Combat & {
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: HeroicReactionKey[],
		options?: { force?: boolean },
	) => Promise<boolean>;
};

export function createHeroicActionsTabState(getActor: () => NimbleCharacter) {
	// Top-level tab for switching between Actions and Reactions
	let activeHeroicTab = $state<'actions' | 'reactions'>('actions');
	let expandedPanel = $state('attack');
	let expandedReactionPanel = $state('defend');

	// ============================================================================
	// Combat State Management
	// ============================================================================

	const subscribeCombatState = createSubscriber(registerCombatStateHooks);

	function getCombat(): CombatWithHeroicReactionUse | null {
		return getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	}

	function getCombatantInCombat(): Combatant | null {
		const combat = getCombat();
		if (!combat) return null;
		return combat.combatants.find((entry) => entry.actorId === getActor().id) ?? null;
	}

	function getCombatant(): Combatant | null {
		const combat = getCombat();
		if (!combat) return null;
		return combat.combatants.find((entry) => entry.actorId === getActor().id) ?? null;
	}

	function isInActiveCombat(): boolean {
		const combatant = getCombatant();
		if (!combatant) return false;
		return combatant.initiative !== null;
	}

	function getActionsData(): ActionsData {
		const combatant = getCombatantInCombat();
		if (!combatant) return { current: 0, max: 3 };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const actions = (combatant as any).system?.actions?.base;
		return {
			current: actions?.current ?? 0,
			max: actions?.max ?? 3,
		};
	}

	async function updateActionPips(newValue: number): Promise<void> {
		const combat = getCombat();
		const combatantId = getCombatantInCombat()?.id ?? null;
		if (!combat || !combatantId) return;

		await queueCombatantMutationWithFreshDocument({
			combat,
			combatantId,
			mutation: async (currentCombatant) => {
				await currentCombatant.update({
					'system.actions.base.current': newValue,
				} as Record<string, unknown>);
			},
		});
	}

	async function deductActionPips(count = 1): Promise<void> {
		const { current } = getActionsData();
		if (current > 0) {
			const newValue = Math.max(0, current - count);
			await updateActionPips(newValue);
		}
	}

	// Reactive combat state
	const inCombat = $derived.by(() => {
		subscribeCombatState();
		return isInActiveCombat();
	});

	const actionsData = $derived.by(() => {
		subscribeCombatState();
		return getActionsData();
	});

	const reactionUsageStates = $derived.by((): ReactionUsageStateMap => {
		subscribeCombatState();
		const combat = getCombat();
		const combatant = getCombatant();
		return HEROIC_REACTIONS.reduce((acc, reaction) => {
			acc[reaction.id as HeroicReactionId] = getHeroicReactionUsageState({
				combat,
				combatant,
				reactionKeys: [reaction.reactionKey],
			});
			return acc;
		}, {} as ReactionUsageStateMap);
	});

	const interposeAndDefendUsageState = $derived.by((): HeroicReactionUsageState => {
		subscribeCombatState();
		return getHeroicReactionUsageState({
			combat: getCombat(),
			combatant: getCombatant(),
			reactionKeys: ['interpose', 'defend'],
		});
	});

	// ============================================================================
	// Panel State & Action Handlers
	// ============================================================================

	function togglePanel(panelName: string): void {
		if (expandedPanel === panelName) {
			return;
		}
		expandedPanel = panelName;
	}

	function handleActionClick(action: HeroicAction): void {
		switch (action.type) {
			case 'panel':
				togglePanel(action.id);
				break;
		}
	}

	function toggleReactionPanel(panelName: string): void {
		if (expandedReactionPanel === panelName) {
			return;
		}
		expandedReactionPanel = panelName;
	}

	function handleReactionClick(reaction: HeroicReaction): void {
		switch (reaction.type) {
			case 'panel':
				toggleReactionPanel(reaction.id);
				break;
		}
	}

	function getReactionUsageState(reaction: HeroicReaction): HeroicReactionUsageState {
		return reactionUsageStates[reaction.id as HeroicReactionId];
	}

	function isReactionAvailable(reactionKey: HeroicReactionKey): boolean {
		const reaction = HEROIC_REACTIONS.find((entry) => entry.reactionKey === reactionKey);
		if (!reaction) return false;
		return getReactionUsageState(reaction).isAvailable;
	}

	function canUseReaction(reactionKey: HeroicReactionKey): boolean {
		const reaction = HEROIC_REACTIONS.find((entry) => entry.reactionKey === reactionKey);
		if (!reaction) return false;
		return getReactionUsageState(reaction).canUse;
	}

	async function useReaction(
		reactionKey: HeroicReactionKey,
		options?: { force?: boolean },
	): Promise<boolean> {
		return useReactionCombo([reactionKey], options);
	}

	async function useReactionCombo(
		reactionKeys: HeroicReactionKey[],
		options?: { force?: boolean },
	): Promise<boolean> {
		const combat = getCombat();
		const combatant = getCombatant();
		const combatantId = combatant?.id ?? combatant?._id ?? null;
		if (!combat?.useHeroicReactions || !combatantId) return false;
		return combat.useHeroicReactions(combatantId, reactionKeys, options);
	}

	function handleHelpDialog(): void {
		GenericDialog.getOrCreate(
			localize('NIMBLE.ui.heroicActions.help.dialogTitle'),
			HeroicActionsHelpDialog,
			{},
			{ width: 480, uniqueId: 'heroic-actions-help' },
		).render(true);
	}

	// ============================================================================
	// Spell Data (for hasSpells check)
	// ============================================================================

	const allSpells = $derived(filterItems(getActor().reactive, ['spell'], ''));
	const hasSpells = $derived(allSpells.length > 0);

	// ============================================================================
	// Derived State
	// ============================================================================

	const flags = $derived(getActor().reactive.flags.nimble);
	const showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

	function isActionDisabled(action: HeroicAction): boolean {
		if (action.requiresCombat) {
			return !inCombat || actionsData.current <= 0;
		}
		if (action.id === 'spell') {
			return !hasSpells;
		}
		return false;
	}

	function getActionTooltip(action: HeroicAction): string {
		const label = localize(action.labelKey);

		if (action.requiresCombat) {
			if (!inCombat) {
				return `${label} (${localize('NIMBLE.ui.heroicActions.outsideCombat')})`;
			}
			if (actionsData.current <= 0) {
				return `${label} (${localize('NIMBLE.ui.heroicActions.noActions')})`;
			}
		}
		if (action.id === 'spell' && !hasSpells) {
			return `${label} (${localize('NIMBLE.ui.heroicActions.noSpells')})`;
		}
		return label;
	}

	function getReactionTooltip(reaction: HeroicReaction): string {
		const usageState = getReactionUsageState(reaction);
		const label = localize(reaction.labelKey);

		if (!usageState.isAvailable) {
			return getHeroicReactionAvailabilityTitle(reaction.reactionKey, false);
		}
		if (usageState.blockedReason === 'outsideCombat') {
			return `${label} (${localize('NIMBLE.ui.heroicActions.outsideCombat')})`;
		}
		if (usageState.blockedReason === 'noActions') {
			return `${label} (${localize('NIMBLE.ui.heroicActions.noActions')})`;
		}
		return getHeroicReactionAvailabilityTitle(reaction.reactionKey, true);
	}

	return {
		get activeHeroicTab() {
			return activeHeroicTab;
		},
		set activeHeroicTab(value: 'actions' | 'reactions') {
			activeHeroicTab = value;
		},
		get expandedPanel() {
			return expandedPanel;
		},
		set expandedPanel(value: string) {
			expandedPanel = value;
		},
		get expandedReactionPanel() {
			return expandedReactionPanel;
		},
		set expandedReactionPanel(value: string) {
			expandedReactionPanel = value;
		},
		get inCombat() {
			return inCombat;
		},
		get actionsData() {
			return actionsData;
		},
		get reactionUsageStates() {
			return reactionUsageStates;
		},
		get canUseInterposeAndDefendCombo() {
			return interposeAndDefendUsageState.canUse;
		},
		get hasSpells() {
			return hasSpells;
		},
		get showEmbeddedDocumentImages() {
			return showEmbeddedDocumentImages;
		},
		HEROIC_ACTIONS,
		HEROIC_REACTIONS,
		canUseReaction,
		deductActionPips,
		handleActionClick,
		handleReactionClick,
		handleHelpDialog,
		isReactionAvailable,
		isActionDisabled,
		getActionTooltip,
		getReactionTooltip,
		useReaction,
		useReactionCombo,
	};
}
