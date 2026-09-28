import { SYSTEM_ID, systemHookName } from '#system';
import { isActiveGM } from '#utils/isActiveGM.js';
import isMonsterScopedCondition from '#utils/isMonsterScopedCondition.js';

let registered = false;

interface ItemLike {
	id?: string | null;
	name?: string;
	system?: { identifier?: string };
	toObject?(): Record<string, unknown>;
}

interface ActorLike {
	uuid?: string | null;
	items?: Iterable<ItemLike>;
	createEmbeddedDocuments?(type: string, data: Record<string, unknown>[]): Promise<unknown>;
	deleteEmbeddedDocuments?(type: string, ids: string[]): Promise<unknown>;
}

interface ConditionAppliedPayload {
	target: ActorLike;
	condition: string;
	effect: { id?: string | null };
	source: { actor?: ActorLike | null } | ActorLike | null;
}

function findFeatureByIdentifier(actor: ActorLike | null, identifier: string): ItemLike | null {
	for (const item of actor?.items ?? []) {
		if (item.system?.identifier === identifier) return item;
	}
	return null;
}

/**
 * The actor the condition came from. `source` is the feature that applied it when there was one,
 * and the creature itself otherwise.
 */
function resolveSourceActor(source: ConditionAppliedPayload['source']): ActorLike | null {
	if (!source) return null;
	const actor = (source as { actor?: ActorLike | null }).actor;
	return actor ?? (source as ActorLike);
}

/**
 * Copy the feature carrying a condition's mechanics onto the creature that just gained it.
 *
 * A monster-scoped condition's rules have to run on the affected creature: Swallowed's recurring
 * damage and cannot-miss belong to whoever is inside the worm, not to the worm. The worm's
 * statblock is the single source of truth for them, so the feature whose identifier matches the
 * condition is copied across and removed again when the condition ends.
 *
 * A creature that already carries the feature keeps its own, so a stirge applying Latched On to
 * itself gains nothing to copy. The feature's rules gate on the `self:condition:<id>` tag, so they
 * lie dormant until the condition is actually held.
 */
async function grantConditionRuleItem(payload: ConditionAppliedPayload): Promise<void> {
	const { target, condition, effect } = payload;
	if (!isMonsterScopedCondition(condition)) return;

	const effectId = effect?.id;
	if (!effectId) return;

	if (findFeatureByIdentifier(target, condition)) return;

	const sourceFeature = findFeatureByIdentifier(resolveSourceActor(payload.source), condition);
	if (!sourceFeature?.toObject) return;

	const source = sourceFeature.toObject();
	delete source._id;

	const flags = (source.flags ?? {}) as Record<string, Record<string, unknown>>;
	source.flags = {
		...flags,
		[SYSTEM_ID]: { ...(flags[SYSTEM_ID] ?? {}), conditionGrant: { condition, effectId } },
	};

	await target.createEmbeddedDocuments?.('Item', [source]);
}

function getConditionGrant(item: ItemLike): { effectId?: unknown } | null {
	const flags = (item as { flags?: Record<string, { conditionGrant?: { effectId?: unknown } }> })
		.flags;
	return flags?.[SYSTEM_ID]?.conditionGrant ?? null;
}

async function revokeConditionRuleItems(effect: {
	id?: string | null;
	parent?: ActorLike | null;
}): Promise<void> {
	const actor = effect.parent;
	if (!actor || !effect.id) return;

	const ids: string[] = [];
	for (const item of actor.items ?? []) {
		if (getConditionGrant(item)?.effectId !== effect.id) continue;
		if (item.id) ids.push(item.id);
	}

	if (ids.length === 0) return;
	await actor.deleteEmbeddedDocuments?.('Item', ids);
}

/** Gated to the active GM so the item creations and deletions run exactly once. */
export default function registerConditionRuleGrantHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on(
		systemHookName('conditionApplied') as 'createItem',
		((payload: ConditionAppliedPayload) => {
			if (!isActiveGM()) return;
			void grantConditionRuleItem(payload);
		}) as never,
	);

	Hooks.on('deleteActiveEffect', (effect) => {
		if (!isActiveGM()) return;
		void revokeConditionRuleItems(effect as unknown as { id?: string | null; parent?: ActorLike });
	});
}
