export const COMBATANT_ACTIONS_CURRENT_PATH = 'system.actions.base.current';
export const COMBATANT_ACTIONS_MAX_PATH = 'system.actions.base.max';

function toFiniteNonNegativeNumber(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 0;
	return Math.max(0, numericValue);
}

export function getCombatantCurrentActions(combatant: Combatant.Implementation): number {
	return toFiniteNonNegativeNumber(
		foundry.utils.getProperty(combatant, COMBATANT_ACTIONS_CURRENT_PATH),
	);
}

export function getCombatantMaxActions(combatant: Combatant.Implementation): number {
	return toFiniteNonNegativeNumber(
		foundry.utils.getProperty(combatant, COMBATANT_ACTIONS_MAX_PATH),
	);
}

export function canCurrentUserEndTurn(combatant: Combatant.Implementation | null): boolean {
	if (!combatant) return false;
	if (game.user?.isGM) return true;
	return Boolean(combatant.actor?.isOwner);
}

export async function consumeCombatantAction(params: {
	combat: Combat;
	combatantId: string;
	fallbackCombatant?: Combatant.Implementation | null;
}): Promise<number> {
	const combatant =
		params.combat.combatants.get(params.combatantId) ??
		params.fallbackCombatant ??
		null;
	if (!combatant) return 0;

	const currentActions = getCombatantCurrentActions(combatant);
	if (currentActions < 1) return 0;

	const nextActions = Math.max(0, currentActions - 1);
	const actionUpdate: Record<string, unknown> = {
		_id: params.combatantId,
		[COMBATANT_ACTIONS_CURRENT_PATH]: nextActions,
	};
	await params.combat.updateEmbeddedDocuments('Combatant', [
		actionUpdate,
	]);
	return nextActions;
}

export async function maybeAdvanceTurnForCombatant(params: {
	combat: Combat;
	combatantId: string | null | undefined;
	endTurn: boolean;
}): Promise<boolean> {
	if (!params.endTurn) return false;
	const activeCombatantId = params.combat.combatant?.id ?? null;
	if (!activeCombatantId || !params.combatantId) return false;
	if (activeCombatantId !== params.combatantId) return false;
	await params.combat.nextTurn();
	return true;
}
