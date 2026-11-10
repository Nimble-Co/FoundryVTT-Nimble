import { isUnclaimedBaseEffect } from '../../models/activeEffect/isUnclaimedBaseEffect.js';
import {
	LEGACY_CONDITION_EFFECT_TYPE,
	NIMBLE_EFFECT_TYPE,
} from '../../models/activeEffect/nimbleEffectChoices.js';
import { MigrationBase } from '../MigrationBase.js';

interface DeltaEffectSource {
	_id: string;
	_tombstone?: boolean;
	type?: string;
	flags?: Record<string, unknown>;
	system?: { changes?: unknown[] };
}

interface DeltaItemSource {
	_id: string;
	_tombstone?: boolean;
	effects?: DeltaEffectSource[];
}

interface EffectParent {
	updateEmbeddedDocuments(
		embeddedName: 'ActiveEffect',
		updates: object[],
		operation: { noHook: boolean },
	): Promise<unknown>;
}

function needsNimbleType(source: DeltaEffectSource): boolean {
	return source.type === LEGACY_CONDITION_EFFECT_TYPE || isUnclaimedBaseEffect(source);
}

/** Core accepts a type change only when `system` is a forced replacement. */
function nimbleTypeChange(source: DeltaEffectSource) {
	return {
		type: NIMBLE_EFFECT_TYPE,
		system: foundry.data.operators.ForcedReplacement.create({
			changes: source.system?.changes ?? [],
		}),
	};
}

async function convertEffects(
	parent: EffectParent,
	effects: DeltaEffectSource[] | undefined,
): Promise<void> {
	const updates = (effects ?? [])
		.filter((effect) => !effect._tombstone && needsNimbleType(effect))
		.map((effect) => ({ _id: effect._id, ...nimbleTypeChange(effect) }));
	if (updates.length === 0) return;

	try {
		await parent.updateEmbeddedDocuments('ActiveEffect', updates, { noHook: true });
	} catch (error) {
		console.warn(error);
	}
}

/**
 * Effects that a world holds from before the Nimble effect type are `base` or
 * the legacy `condition` type. Both become `nimble` with their changes kept.
 * A `base` effect that another package flags stays as it is.
 */
class Migration085NimbleEffectType extends MigrationBase {
	static override readonly version = 85;

	override readonly version = Migration085NimbleEffectType.version;

	// The runner does not call updateEffect for the effects of an actor's items.
	override async updateItem(source: any): Promise<void> {
		for (const effect of source?.effects ?? []) await this.updateEffect(effect);
	}

	override async updateEffect(source: any): Promise<void> {
		if (!source || !needsNimbleType(source)) return;
		Object.assign(source, nimbleTypeChange(source));
	}

	/** Effects that only the delta of an unlinked token holds. */
	override async migrate(): Promise<void> {
		for (const scene of game.scenes ?? []) {
			for (const token of scene.tokens) {
				if (token.actorLink) continue;
				const actor = token.actor;
				const delta = token.delta?._source as
					| { effects?: DeltaEffectSource[]; items?: DeltaItemSource[] }
					| undefined;
				if (!actor || !delta) continue;

				await convertEffects(actor, delta.effects);
				for (const itemSource of delta.items ?? []) {
					if (itemSource._tombstone) continue;
					const item = actor.items.get(itemSource._id);
					if (item) await convertEffects(item, itemSource.effects);
				}
			}
		}
	}
}

export { Migration085NimbleEffectType };
