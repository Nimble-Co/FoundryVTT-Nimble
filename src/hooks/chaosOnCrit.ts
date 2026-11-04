import { SYSTEM_ID } from '#system';
import { CHAOS_INVOKED_FLAG, canInvokeChaos, invokeChaos } from '#utils/chaos/invokeChaos.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

interface AttackCard {
	id?: string | null;
	author?: { id?: string | null; active?: boolean } | null;
	speaker?: unknown;
	system?: { isCritical?: boolean; pendingKeep?: unknown };
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

/** The author's client writes, so a Chaos card is theirs to click. The GM stands in. */
function isAttackAuthorClient(card: AttackCard): boolean {
	if (card.author?.active) return card.author.id === game.user?.id;
	return isActiveGM();
}

const invoked = new Set<string>();

export async function invokeChaosOnCrit(card: AttackCard): Promise<void> {
	if (!card.id || card.system?.isCritical !== true || !isRuleAutomationEnabled()) return;
	if (card.system.pendingKeep) return;
	if (invoked.has(card.id) || card.getFlag(SYSTEM_ID, CHAOS_INVOKED_FLAG)) return;
	if (!isAttackAuthorClient(card)) return;
	const actor = ChatMessage.getSpeakerActor(card.speaker as never);
	if (!actor || !canInvokeChaos(actor as never)) return;

	invoked.add(card.id);
	await card.setFlag(SYSTEM_ID, CHAOS_INVOKED_FLAG, true);
	await invokeChaos(actor as never, card.id);
}

let registered = false;

export function registerChaosOnCritHooks(): void {
	if (registered) return;
	registered = true;
	const onCard = (card: unknown) => {
		void invokeChaosOnCrit(card as AttackCard).catch((error) => {
			console.error('Nimble | Could not invoke Chaos.', error);
		});
	};
	Hooks.on('createChatMessage', onCard);
	Hooks.on('updateChatMessage', onCard);
}
