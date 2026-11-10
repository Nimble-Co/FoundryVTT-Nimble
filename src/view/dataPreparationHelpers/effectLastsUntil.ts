import {
	type CoreDurationUnits,
	describeLastsUntil,
	holderReader,
} from '#utils/lastsUntil/describeLastsUntil.js';
import { escapeDcOf } from '#utils/lastsUntil/escapeEffect.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';

export interface LastsUntilEffect {
	origin?: string | null;
	system?: unknown;
	duration?: { value?: number | null; units?: string | null } | null;
	_source?: { duration?: { value?: number | null; units?: string | null } | null };
}

interface Creature {
	uuid?: string | null;
	name?: string | null;
}

/** The creature in the effect's origin: the actor, or the actor of the item. */
export function sourceCreature(effect: LastsUntilEffect): Creature | null {
	if (!effect.origin) return null;
	const document = fromUuidSync(effect.origin as never, { strict: false }) as
		| (Creature & { documentName?: string; actor?: Creature | null })
		| null;
	if (!document) return null;
	return document.documentName === 'Actor' ? document : (document.actor ?? null);
}

/** The name of the document in the effect's origin: the item, or the creature. */
export function originName(effect: LastsUntilEffect): string {
	if (!effect.origin) return '';
	const document = fromUuidSync(effect.origin as never, { strict: false }) as Creature | null;
	return document?.name ?? '';
}

function coreDurationOf(
	effect: LastsUntilEffect,
): Partial<Record<CoreDurationUnits, number>> | null {
	const duration = effect._source?.duration ?? effect.duration;
	const value = Number(duration?.value);
	const units = duration?.units as CoreDurationUnits | undefined;
	if (!units || !Number.isFinite(value) || value <= 0) return null;
	return { [units]: value };
}

/** The user owns the effect and it has an Escape DC. */
export function escapeOf(effect: {
	isOwner?: boolean;
	system?: unknown;
}): { dc: number | null } | null {
	const dc = (effect.system as { escape?: { dc?: string } } | undefined)?.escape?.dc;
	if (!effect.isOwner || !dc?.trim()) return null;
	return { dc: escapeDcOf(dc) };
}

/** How long the effect lasts, as its holder reads it: "Until Goblin Boss drops to 0 HP". */
export function effectLastsUntil(effect: LastsUntilEffect, holder: Creature | null): string {
	const system = (effect.system ?? {}) as {
		lastsUntil?: Moment[];
		escape?: { dc?: string };
	};
	const source = sourceCreature(effect);
	const sourceName = source && source.uuid !== holder?.uuid ? (source.name ?? null) : null;
	return describeLastsUntil({
		moments: system.lastsUntil ?? [],
		coreDuration: coreDurationOf(effect),
		escape: !!system.escape?.dc?.trim(),
		reader: holderReader(sourceName),
		localize,
		format: localize,
	});
}
