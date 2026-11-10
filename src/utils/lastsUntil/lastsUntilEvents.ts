import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import type { LastsUntilEvent } from '../../models/activeEffect/nimbleEffectChoices.js';
import localize from '../localize.js';
import { effectsEndingAt, endEffects } from './endEffects.js';
import type { LastsUntilCheck } from './momentReached.js';

interface UsedItem {
	uuid?: string | null;
	name?: string | null;
	type?: string;
	actor?: object | null;
	system?: unknown;
}

/**
 * Decision 19: an activation with a damage roll, or one that asks a creature
 * other than its user for a save.
 */
export function isAttackUse(item: UsedItem, targetActors: readonly object[]): boolean {
	const { activation } = (item.system ?? {}) as {
		activation?: { effects?: EffectNode[]; targets?: { attackType?: string } };
	};
	if (activation?.targets?.attackType) return true;
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

export function eventHeading(event: LastsUntilEvent, names: HeadingNames): string {
	return localize(`NIMBLE.lastsUntil.chat.heading.${event}`, {
		name: names.name ?? '',
		item: names.item ?? '',
		effect: names.effect ?? '',
	});
}

type EventCheck = Extract<LastsUntilCheck, { type: 'event' }>;

/**
 * End what each event ends, one message for each event. An effect that more
 * than one of them ends goes with the first. Run where the event happens: the
 * effects are found now, before what happens next changes them.
 */
export function fireEvents(events: readonly { check: EventCheck; heading: string }[]): void {
	const taken = new Set<ActiveEffect>();
	for (const { check, heading } of events) {
		const effects = effectsEndingAt(check).filter((effect) => !taken.has(effect));
		for (const effect of effects) taken.add(effect);
		void endEffects(effects, heading);
	}
}

export function fireEvent(
	event: LastsUntilEvent,
	actor: { name?: string | null } | null,
	extra: Partial<Omit<EventCheck, 'type' | 'event' | 'actor'>> & HeadingNames = {},
): void {
	if (!actor) return;
	const { item, effect, ...check } = extra;
	fireEvents([
		{
			check: { type: 'event', event, actor, ...check },
			heading: eventHeading(event, { name: actor.name, item, effect }),
		},
	]);
}

/** The events of one item use: an attack, a spell cast, and a use of the item again. */
export function fireItemUseEvents(item: UsedItem, targetActors: readonly object[]): void {
	const actor = item.actor as { name?: string | null } | null;
	if (!actor) return;
	const name = actor.name;
	const events: { check: EventCheck; heading: string }[] = [];
	if (isAttackUse(item, targetActors)) {
		events.push({
			check: { type: 'event', event: 'attack', actor },
			heading: eventHeading('attack', { name }),
		});
	}
	if (item.type === 'spell') {
		events.push({
			check: { type: 'event', event: 'castSpell', actor },
			heading: eventHeading('castSpell', { name }),
		});
	}
	if (item.uuid) {
		events.push({
			check: { type: 'event', event: 'useAgain', actor, itemUuid: item.uuid },
			heading: eventHeading('useAgain', { name, item: item.name }),
		});
	}
	fireEvents(events);
}
