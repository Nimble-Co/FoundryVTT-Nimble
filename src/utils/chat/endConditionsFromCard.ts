import { SYSTEM_ID } from '#system';
import type { EndConditionsNode } from '#types/effectTree.js';
import { effectsToEnd } from '#utils/actor/endConditions.js';
import { endEffects } from '#utils/lastsUntil/endEffects.js';
import { cardItem, cardUser, type EffectCard, stepRecipients } from './applyEffectFromCard.js';

export const ENDED_CONDITIONS_FLAG = 'endedConditions';

/** What the step ended on one creature, by effect name. Empty: it had nothing to end. */
export interface EndedConditionsRecord {
	actorName: string;
	ended: string[];
}

interface EndHolder {
	uuid: string;
	name?: string | null;
	effects?: Iterable<ActiveEffect>;
	statuses?: Set<string>;
}

/** What the End Conditions step of the card ended, by creature. */
export function endedConditions(
	card: EffectCard,
	nodeId: string,
): Record<string, EndedConditionsRecord> | undefined {
	const flags = (card.flags?.[SYSTEM_ID] ?? {}) as {
		[ENDED_CONDITIONS_FLAG]?: Record<string, Record<string, EndedConditionsRecord>>;
	};
	return flags[ENDED_CONDITIONS_FLAG]?.[nodeId];
}

/**
 * Ends the step's effects on the card's targets, or on its user, through the Lasts Until end path:
 * each ended effect gets its line with Undo on this card. A creature whose ends no GM took gets no
 * record, so the button stays.
 */
export async function endConditionsFromCard(
	card: EffectCard,
	node: EndConditionsNode,
): Promise<void> {
	const user = cardUser(card);
	const recipients = stepRecipients(card, node) as unknown as EndHolder[];
	const item = cardItem(card)?.name ?? '';
	const changes: Record<string, EndedConditionsRecord> = {};
	for (const actor of recipients) {
		const effects = effectsToEnd(actor, node);
		const taken =
			effects.length < 1 ||
			(await endEffects(effects, {
				heading: {
					key: 'NIMBLE.chat.events.useHeading',
					data: { name: user?.name ?? '', item },
				},
				...(card.id ? { hostId: card.id } : {}),
				reason: { key: 'NIMBLE.chat.endConditions.endedBy', data: { item } },
			}));
		if (!taken) continue;
		const key = actor.uuid.replaceAll('.', '_');
		changes[`flags.${SYSTEM_ID}.${ENDED_CONDITIONS_FLAG}.${node.id}.${key}`] = {
			actorName: actor.name ?? '',
			ended: effects.map((effect) => effect.name ?? ''),
		};
	}
	if (Object.keys(changes).length > 0) await card.update(changes);
}
