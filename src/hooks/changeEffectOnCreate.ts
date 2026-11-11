import { rulesOfType } from '#utils/actor/actorRules.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import type { LastsUntilEvent } from '../models/activeEffect/nimbleEffectChoices.js';

interface NewEffect {
	parent?: unknown;
	origin?: string | null;
	system?: { lastsUntil?: Moment[] } | null;
	updateSource(changes: Record<string, unknown>): unknown;
}

interface IdentifiedItem {
	identifier?: string;
	system?: { identifier?: string };
}

function originIdentifierOf(effect: NewEffect): string | null {
	if (!effect.origin) return null;
	const origin = fromUuidSync(effect.origin as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as unknown;
	if (!(origin instanceof Item)) return null;
	const item = origin as IdentifiedItem;
	return item.identifier || item.system?.identifier || null;
}

function eventMoment(event: LastsUntilEvent): Moment {
	return {
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who: event === 'effectEnds' ? null : 'holder',
		event,
		effectName: '',
	};
}

/** The new effect's moments, as the actor's Change an Effect rules for its origin item change them. */
function changedMoments(effect: NewEffect): Moment[] | null {
	const holder = effect.parent;
	if (!(holder instanceof Actor)) return null;
	const moments = effect.system?.lastsUntil;
	if (!Array.isArray(moments)) return null;
	const identifier = originIdentifierOf(effect);
	if (!identifier) return null;

	const rules = rulesOfType(holder as { rules?: unknown }, 'changeEffect').filter((rule) =>
		rule.changesEffectsOf(identifier),
	);
	if (rules.length < 1) return null;

	const removed = new Set(rules.flatMap((rule) => rule.removeMoments));
	const kept = moments.filter(
		(moment) => !(moment.kind === 'event' && moment.event && removed.has(moment.event)),
	);
	const present = new Set(
		kept.flatMap((moment) => (moment.kind === 'event' ? [moment.event] : [])),
	);
	const added: Moment[] = [];
	for (const event of rules.flatMap((rule) => rule.addMoments)) {
		if (present.has(event)) continue;
		present.add(event);
		added.push(eventMoment(event));
	}
	if (added.length < 1 && kept.length === moments.length) return null;
	return [...kept.map((moment) => ({ ...moment })), ...added];
}

/** An effect is changed when it is made, on the creating client, never once it is on the actor. */
export function changeNewEffect(effect: NewEffect): void {
	const next = changedMoments(effect);
	if (next) effect.updateSource({ 'system.lastsUntil': next });
}

let registered = false;

export default function registerChangeEffectOnCreateHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('preCreateActiveEffect', (effect) => {
		changeNewEffect(effect as unknown as NewEffect);
	});
}
