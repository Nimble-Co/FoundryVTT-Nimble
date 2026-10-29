import { SYSTEM_ID } from '#system';
import { isActiveGM } from '#utils/isActiveGM.js';
import {
	MARK_TARGET_ITEM_FLAG,
	type MarkEffectTarget,
	removeMarkEffect,
} from './markTargetEffects.js';
import {
	readToggledEffects,
	TOGGLED_EFFECTS_FLAG_KEY,
	type ToggledEffectsFlag,
	type ToggledTargetEntry,
} from './toggledEffects.js';

interface MarkRuleLike {
	type: string;
	flagKey?: string;
	endsAtEncounterEnd?: boolean;
	disabled?: boolean;
	item?: { uuid: string };
}

interface MarkOwner {
	rules?: Iterable<MarkRuleLike>;
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

interface MarkerEffect {
	parent?: { uuid?: string } | null;
	getFlag(scope: string, key: string): unknown;
}

function markRules(rules: Iterable<MarkRuleLike> | undefined): MarkRuleLike[] {
	return [...(rules ?? [])].filter((rule) => rule.type === 'markTarget' && !rule.disabled);
}

async function markedActor(entry: ToggledTargetEntry): Promise<MarkEffectTarget | null> {
	if (entry.tokenUuid) {
		const token = (await fromUuid(entry.tokenUuid as Parameters<typeof fromUuid>[0])) as {
			actor?: MarkEffectTarget | null;
		} | null;
		if (token?.actor) return token.actor;
	}
	return (await fromUuid(
		entry.actorUuid as Parameters<typeof fromUuid>[0],
	)) as MarkEffectTarget | null;
}

/** Ends the marks of the owner's Mark Target rules that end at the end of the encounter. */
export async function endEncounterMarks(owner: MarkOwner): Promise<void> {
	const ending = markRules(owner.rules).filter((rule) => rule.endsAtEncounterEnd && rule.flagKey);
	const flag: ToggledEffectsFlag = { ...readToggledEffects(owner) };
	const ended = ending.flatMap((rule) =>
		(flag[rule.flagKey as string] ?? []).map((entry) => ({ rule, entry })),
	);
	if (ended.length === 0) return;

	for (const rule of ending) flag[rule.flagKey as string] = [];
	await owner.setFlag(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, flag);

	for (const { rule, entry } of ended) {
		const target = await markedActor(entry);
		if (target && rule.item) await removeMarkEffect({ target, sourceItemUuid: rule.item.uuid });
	}
}

/**
 * Ends the mark a marker effect stands for, when someone takes the marker off
 * the creature by hand. A mark that is already gone changes nothing.
 */
export async function endMarkOfRemovedMarker(effect: MarkerEffect): Promise<void> {
	const itemUuid = effect.getFlag(SYSTEM_ID, MARK_TARGET_ITEM_FLAG);
	const markedUuid = effect.parent?.uuid;
	if (typeof itemUuid !== 'string' || !markedUuid) return;

	const item = fromUuidSync(itemUuid as Parameters<typeof fromUuidSync>[0]) as {
		actor?: MarkOwner | null;
		rules?: Map<string, MarkRuleLike>;
	} | null;
	const owner = item?.actor;
	if (!owner) return;

	const flag: ToggledEffectsFlag = { ...readToggledEffects(owner) };
	let changed = false;
	for (const rule of markRules(item.rules?.values())) {
		const key = rule.flagKey;
		if (!key || !Array.isArray(flag[key])) continue;
		const kept = flag[key].filter((entry) => entry.actorUuid !== markedUuid);
		if (kept.length === flag[key].length) continue;
		flag[key] = kept;
		changed = true;
	}
	if (changed) await owner.setFlag(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, flag);
}

let registered = false;

export function registerMarkLifecycleHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('deleteActiveEffect', (effect: unknown) => {
		if (!isActiveGM()) return;
		void endMarkOfRemovedMarker(effect as MarkerEffect);
	});
}
