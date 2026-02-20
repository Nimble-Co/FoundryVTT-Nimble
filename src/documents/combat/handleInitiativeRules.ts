import combatManaHandler from './handlers/combatManaHandler.js';

interface HandleInitiativeRulesParams {
	combatId: string | null;
	combatManaUpdates: Promise<unknown>[];
	combatant: Combatant.Implementation;
}

export async function handleInitiativeRules(params: HandleInitiativeRulesParams): Promise<void> {
	await combatManaHandler(params);
}
