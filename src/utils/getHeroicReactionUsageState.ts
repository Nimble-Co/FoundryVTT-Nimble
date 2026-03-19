import {
	canOwnerUseHeroicReaction,
	getHeroicReactionAvailability,
	type HeroicReactionKey,
} from './heroicActions.js';
import { isCombatantDead } from './isCombatantDead.js';

type HeroicReactionUsageBlockedReason =
	| 'outsideCombat'
	| 'dead'
	| 'spent'
	| 'notOwner'
	| 'activeTurn'
	| 'noActions'
	| 'notUsable';

interface GetHeroicReactionUsageStateParams {
	combat: Combat | null;
	combatant: Combatant.Implementation | null | undefined;
	reactionKeys: HeroicReactionKey[];
}

function getCombatantId(combatant: Combatant.Implementation | null | undefined): string | null {
	return combatant?.id ?? combatant?._id ?? null;
}

function isCombatStarted(combat: Combat | null): boolean {
	return Number(combat?.round ?? 0) >= 1;
}

function getCombatantCurrentActions(
	combatant: Combatant.Implementation | null | undefined,
): number {
	if (!combatant) return 0;

	const value = foundry.utils.getProperty(combatant, 'system.actions.base.current');
	return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

function normalizeReactionKeys(reactionKeys: HeroicReactionKey[]): HeroicReactionKey[] {
	return Array.from(new Set(reactionKeys));
}

export function getHeroicReactionUsageState({
	combat,
	combatant,
	reactionKeys,
}: GetHeroicReactionUsageStateParams) {
	const normalizedReactionKeys = normalizeReactionKeys(reactionKeys);
	const requiredActions = normalizedReactionKeys.length;
	const currentActions = getCombatantCurrentActions(combatant);
	const activeCombatantId = combat?.combatant?.id ?? combat?.combatant?._id ?? null;
	const combatantId = getCombatantId(combatant);
	const isAvailable =
		combatant != null &&
		normalizedReactionKeys.length > 0 &&
		normalizedReactionKeys.every((reactionKey) =>
			getHeroicReactionAvailability(combatant, reactionKey),
		);

	let blockedReason: HeroicReactionUsageBlockedReason | null = null;

	if (!combat || !combatant || !isCombatStarted(combat)) {
		blockedReason = 'outsideCombat';
	} else if (isCombatantDead(combatant)) {
		blockedReason = 'dead';
	} else if (!isAvailable) {
		blockedReason = 'spent';
	} else if (
		!normalizedReactionKeys.every((reactionKey) => canOwnerUseHeroicReaction(reactionKey))
	) {
		blockedReason = 'notUsable';
	} else if (!game.user?.isGM && !combatant.actor?.isOwner) {
		blockedReason = 'notOwner';
	} else if (activeCombatantId === combatantId) {
		blockedReason = 'activeTurn';
	} else if (currentActions < requiredActions) {
		blockedReason = 'noActions';
	}

	return {
		canUse: blockedReason === null,
		blockedReason,
		currentActions,
		isAvailable,
		reactionKeys: normalizedReactionKeys,
		requiredActions,
	};
}
