import combatManaHandler from './handlers/combatManaHandler.js';
import initiativeMessageHandler from './handlers/initiativeMessageHandler.js';

interface HandleInitiativeRulesParams {
	combatId: string | null;
	combatManaUpdates: Promise<unknown>[];
	combatant: Combatant.Implementation;
}

export async function handleInitiativeRules(params: HandleInitiativeRulesParams): Promise<void> {
	await combatManaHandler(params);
	await initiativeMessageHandler(params.combatant);
}
