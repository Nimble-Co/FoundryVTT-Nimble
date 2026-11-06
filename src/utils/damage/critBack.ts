import { SYSTEM_ID } from '#system';
import type { RuleOf } from '#types/ruleTypes.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { ruleLabel, rulesOfType } from '../actor/actorRules.js';
import localize from '../localize.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';

const SENT_FLAG = 'critBackSent';

interface AttackingItem {
	id?: string | null;
	name?: string;
	system?: { activation?: { effects?: unknown[] } };
	activate?(options: object): Promise<unknown>;
}

interface Creature {
	uuid?: string | null;
	name?: string | null;
	items?: Iterable<AttackingItem>;
	system?: { attributes?: { hp?: { value?: number } } };
}

interface Card {
	id?: string | null;
	flags?: Record<string, Record<string, unknown> | undefined>;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

function critBackRule(
	actor: unknown,
	item: { id?: string | null } | null,
): RuleOf<'critBack'> | null {
	if (!item) return null;
	return (
		rulesOfType(actor as { rules?: unknown } | null, 'critBack').find(
			(rule) => !rule.disabled && rule.item?.id === item.id && rule.appliesTo(),
		) ?? null
	);
}

/** The attacks of a creature: each item with a damage node. */
export function attackRows(creature: Creature) {
	return [...(creature.items ?? [])]
		.filter((item) =>
			(
				flattenEffectsTree((item.system?.activation?.effects ?? []) as never) as { type?: string }[]
			).some((node) => node.type === 'damage'),
		)
		.map((item) => ({ id: item.id ?? '', name: item.name ?? '' }));
}

/**
 * When the damage is applied and the creature lives, the GM gets a card with its
 * attacks. With Feature Effects off the item's text is enough.
 */
export async function sendCritBack(input: {
	card: Card;
	sourceActor: unknown;
	sourceItem: { id?: string | null } | null;
	hurt: Creature[];
	heroTokenUuid: string | null;
}): Promise<void> {
	const { card, sourceActor, sourceItem, hurt, heroTokenUuid } = input;
	if (!isRuleAutomationEnabled() || card.flags?.[SYSTEM_ID]?.[SENT_FLAG]) return;
	const rule = critBackRule(sourceActor, sourceItem);
	if (!rule) return;
	const living = hurt.filter((each) => (each.system?.attributes?.hp?.value ?? 0) > 0);
	if (living.length === 0) return;

	await card.setFlag?.(SYSTEM_ID, SENT_FLAG, true);
	for (const creature of living) {
		await ChatMessage.create({
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor: creature as never }),
			type: 'critBack',
			whisper: ChatMessage.getWhisperRecipients('GM').map((user) => user.id),
			system: {
				actorUuid: creature.uuid ?? '',
				heroTokenUuid: heroTokenUuid ?? '',
				label: ruleLabel(rule),
				text: localize('NIMBLE.chat.critBack.text', {
					creature: creature.name ?? '',
					hero: (sourceActor as { name?: string } | null)?.name ?? '',
				}),
				used: false,
			},
		} as unknown as ChatMessage.CreateData);
	}
}

/** The chosen attack is free, targets the hero and is a crit. */
export async function useCritBack(input: {
	creature: Creature;
	itemId: string;
	heroTokenUuid: string;
	label: string;
}): Promise<unknown> {
	const item = [...(input.creature.items ?? [])].find((each) => each.id === input.itemId);
	const token = fromUuidSync(input.heroTokenUuid) as { id?: string } | null;
	if (token?.id) canvas.tokens?.setTargets([token.id]);
	return item?.activate?.({ fastForward: true, rollMode: 0, grantedCrit: input.label });
}
