import { SYSTEM_ID } from '#system';
import {
	type Application,
	applicationOf,
	newApplicationLastsLonger,
} from '#utils/lastsUntil/lastsLonger.js';
import { roundSeconds, secondsOf } from '#utils/lastsUntil/secondsOf.js';

/** The update option of a stack: the holder gains the effect again. */
export const STACKED_OPTION = 'nimbleEffectStacked';

/** The delete option of an effect whose application is undone or taken back: it does not end. */
export const UNDO_APPLICATION_OPTION = 'nimbleApplicationUndone';

export interface StackFields {
	on: boolean;
	count: number;
	/** At this count the holder gains `effectId`. Null: nothing happens at a count. */
	at: number | null;
	/** An effect of the item that applies the stacking effect. */
	effectId: string;
}

export interface StackingEffect {
	id?: string | null;
	uuid?: string;
	name?: string | null;
	statuses?: Set<string>;
	origin?: string | null;
	system?: unknown;
	duration?: { value?: number | null; units?: string | null } | null;
	start?: { time?: number } | null;
	update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

interface StackHolder {
	effects?: Iterable<object>;
}

/** The stack fields of an effect's system data, with the defaults of an older effect. */
export function stackFieldsOf(system: unknown): StackFields {
	const stacks = (system as { stacks?: Partial<StackFields> } | null | undefined)?.stacks;
	return {
		on: stacks?.on === true,
		count: Math.max(1, Number(stacks?.count) || 1),
		at: typeof stacks?.at === 'number' ? stacks.at : null,
		effectId: stacks?.effectId ?? '',
	};
}

/** The stack fields of an effect's system data, when Stacks is on. */
export function stacksOf(system: unknown): StackFields | null {
	const fields = stackFieldsOf(system);
	return fields.on ? fields : null;
}

/** A formula with `@stacks` put in as the count, for a roll that reads other roll data. */
export function formulaWithStacks(formula: string, count: number): string {
	return formula.replace(/@stacks\b/g, String(count));
}

/** The effect has the wanted statuses, and no others than the ones they bring with them. */
function sameStatuses(held: Set<string> | undefined, wanted: readonly string[]): boolean {
	const linked = (CONFIG.NIMBLE?.conditionLinkedConditions ?? {}) as Record<
		string,
		readonly string[]
	>;
	const allowed = new Set(wanted.flatMap((status) => [status, ...(linked[status] ?? [])]));
	const statuses = held ?? new Set<string>();
	return (
		wanted.every((status) => statuses.has(status)) && [...statuses].every((s) => allowed.has(s))
	);
}

/**
 * The effect on the holder that a new application of `data` adds a stack to: both have Stacks
 * on, the same name and the same conditions. The source does not matter.
 */
export function stackingCopyOf(
	holder: StackHolder,
	data: Record<string, unknown>,
): StackingEffect | null {
	const name = typeof data.name === 'string' ? data.name : '';
	if (!stacksOf(data.system) || !name) return null;
	const statuses = Array.isArray(data.statuses) ? (data.statuses as string[]) : [];
	for (const effect of (holder.effects ?? []) as Iterable<StackingEffect>) {
		if (effect.name !== name || !stacksOf(effect.system)) continue;
		if (sameStatuses(effect.statuses, statuses)) return effect;
	}
	return null;
}

/**
 * One more stack on `copy`. When the new application lasts longer, the effect takes its start,
 * Lasts Until and core duration, and its counts start again. Gives the new count.
 */
export async function stackUp(
	copy: StackingEffect,
	next: Application,
	options: Record<string, unknown> = {},
): Promise<number> {
	const count = (stacksOf(copy.system)?.count ?? 1) + 1;
	const changes: Record<string, unknown> = { 'system.stacks.count': count };
	const context = { roundSeconds: roundSeconds(), secondsOf };
	if (newApplicationLastsLonger(next, [applicationOf(copy as never)], context)) {
		changes.start = CONFIG.ActiveEffect.documentClass.getEffectStart();
		changes['system.lastsUntil'] = [...next.lastsUntil];
		changes['duration.value'] = next.duration?.value ?? null;
		if (next.duration?.units) changes['duration.units'] = next.duration.units;
		changes[`flags.${SYSTEM_ID}.turnsSeen`] = [];
	}
	await copy.update(changes, { [STACKED_OPTION]: true, ...options });
	return count;
}

/** Takes back one application: one stack off, or the effect off at its last stack. */
export async function takeBackStack(
	effect: StackingEffect & { delete(options?: object): Promise<unknown> },
): Promise<void> {
	const stacks = stacksOf(effect.system);
	if (stacks && stacks.count > 1) {
		await effect.update({ 'system.stacks.count': stacks.count - 1 });
		return;
	}
	await effect.delete({ [UNDO_APPLICATION_OPTION]: true });
}
