import type { CardEventText, EventHost } from '#types/cardEvent.d.ts';
import type { EffectNode } from '#types/effectTree.js';
import {
	type EndMoment,
	effectsEndingAt,
	endEffects,
	waitEndEffects,
} from '#utils/lastsUntil/endEffects.js';
import { noteActivity } from '#utils/lastsUntil/inactiveRound.js';
import type { LastsUntilCheck } from '#utils/lastsUntil/momentReached.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import type { LastsUntilEvent } from '../../models/activeEffect/nimbleEffectChoices.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

interface UsedItem {
	uuid?: string | null;
	name?: string | null;
	type?: string;
	actor?: object | null;
	system?: unknown;
}

/**
 * An attack: an activation with a damage roll, or one that asks a creature
 * other than its user for a save. A save with no target chosen counts.
 */
export function isAttackUse(item: UsedItem, targetActors: readonly object[]): boolean {
	const { activation } = (item.system ?? {}) as {
		activation?: { effects?: EffectNode[] };
	};
	const types = new Set(flattenEffectsTree(activation?.effects ?? []).map((node) => node.type));
	if (types.has('damage')) return true;
	if (!types.has('savingThrow')) return false;
	return targetActors.length === 0 || targetActors.some((target) => target !== item.actor);
}

interface HeadingNames {
	name?: string | null;
	item?: string | null;
	effect?: string | null;
}

export function eventHeading(event: LastsUntilEvent, names: HeadingNames): CardEventText {
	return {
		key: `NIMBLE.lastsUntil.chat.heading.${event}`,
		data: { name: names.name ?? '', item: names.item ?? '', effect: names.effect ?? '' },
	};
}

type EventCheck = Extract<LastsUntilCheck, { type: 'event' }>;

/**
 * Where the ends of an event go: the host card, or the card of the host moment with the event as
 * the reason, or else a card of their own headed by the event.
 */
function endMomentOn(heading: CardEventText, host: EventHost): EndMoment {
	if (host && 'moment' in host) {
		return {
			key: host.moment.key,
			heading: host.moment.heading,
			reason: heading,
			...(host.whisper?.length ? { whisper: host.whisper } : {}),
		};
	}
	const hostId = host?.id ?? undefined;
	return { heading, ...(hostId ? { hostId } : {}) };
}

/**
 * End what each event ends, one message for each event, or lines on `host`. An effect that more
 * than one of them ends goes with the first. Run where the event happens: the effects are found
 * now, before what happens next changes them. With Feature Effects off, the ends wait for End.
 */
export function fireEvents(
	events: readonly { check: EventCheck; heading: CardEventText }[],
	host?: EventHost,
): void {
	const taken = new Set<ActiveEffect>();
	for (const { check, heading } of events) {
		const effects = effectsEndingAt(check).filter((effect) => !taken.has(effect));
		for (const effect of effects) taken.add(effect);
		const moment = endMomentOn(heading, host);
		if (isRuleAutomationEnabled()) void endEffects(effects, moment, { check });
		else void waitEndEffects(effects, moment, { check });
	}
}

export function fireEvent(
	event: LastsUntilEvent,
	actor: { name?: string | null } | null,
	extra: Partial<Omit<EventCheck, 'type' | 'event' | 'actor'>> & HeadingNames = {},
	host?: EventHost,
): void {
	if (!actor) return;
	const { item, effect, ...check } = extra;
	fireEvents(
		[
			{
				check: { type: 'event', event, actor, ...check },
				heading: eventHeading(event, { name: actor.name, item, effect }),
			},
		],
		host,
	);
}

/**
 * An attack that is not an item use: an attack, and so a roll. Resolves when the activity of the
 * attacker is saved.
 */
export function fireAttackEvents(
	actor: { name?: string | null } | null,
	host?: EventHost,
): Promise<void> {
	if (!actor) return Promise.resolve();
	const noted = noteActivity(actor, { attack: true });
	const name = actor.name;
	fireEvents(
		[
			{
				check: { type: 'event', event: 'attack', actor },
				heading: eventHeading('attack', { name }),
			},
			{
				check: { type: 'event', event: 'nextRoll', actor },
				heading: eventHeading('nextRoll', { name }),
			},
		],
		host,
	);
	return noted;
}

/** A spell of tier 1 or more. A cantrip is tier 0. */
function isTieredSpell(item: UsedItem): boolean {
	return item.type === 'spell' && Number((item.system as { tier?: number })?.tier ?? 0) >= 1;
}

/**
 * The events of one item use: an attack (also a roll), a spell cast, a tiered spell cast, and a
 * use of the item again, with lines on the item card `host`. Resolves when the activity of the
 * user is saved.
 */
export function fireItemUseEvents(
	item: UsedItem,
	targetActors: readonly object[],
	host?: EventHost,
): Promise<void> {
	const actor = item.actor as { name?: string | null } | null;
	if (!actor) return Promise.resolve();
	const attack = isAttackUse(item, targetActors);
	const noted = noteActivity(actor, { attack, itemUuid: item.uuid });
	const name = actor.name;
	const events: { check: EventCheck; heading: CardEventText }[] = [];
	if (attack) {
		events.push({
			check: { type: 'event', event: 'attack', actor },
			heading: eventHeading('attack', { name }),
		});
		events.push({
			check: { type: 'event', event: 'nextRoll', actor },
			heading: eventHeading('nextRoll', { name }),
		});
	}
	if (item.type === 'spell') {
		events.push({
			check: { type: 'event', event: 'castSpell', actor },
			heading: eventHeading('castSpell', { name }),
		});
	}
	if (isTieredSpell(item)) {
		events.push({
			check: { type: 'event', event: 'nextSpell', actor },
			heading: eventHeading('nextSpell', { name }),
		});
	}
	if (item.uuid) {
		events.push({
			check: { type: 'event', event: 'useAgain', actor, itemUuid: item.uuid },
			heading: eventHeading('useAgain', { name, item: item.name }),
		});
	}
	fireEvents(events, host);
	return noted;
}
