import { isUnclaimedBaseEffect } from '../../models/activeEffect/isUnclaimedBaseEffect.js';
import {
	LEGACY_CONDITION_EFFECT_TYPE,
	NIMBLE_EFFECT_TYPE,
} from '../../models/activeEffect/nimbleEffectChoices.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

interface EffectSource {
	type?: string;
	flags?: Record<string, unknown>;
	system?: { changes?: unknown[] };
}

function needsNimbleType(source: EffectSource): boolean {
	return source.type === LEGACY_CONDITION_EFFECT_TYPE || isUnclaimedBaseEffect(source);
}

/** Core accepts a type change only when `system` is a forced replacement. */
function nimbleTypeChange(source: EffectSource) {
	return {
		type: NIMBLE_EFFECT_TYPE,
		system: foundry.data.operators.ForcedReplacement.create({
			changes: source.system?.changes ?? [],
		}),
	};
}

/**
 * Effects that a world holds from before the Nimble effect type are `base` or
 * the legacy `condition` type. Both become `nimble` with their changes kept.
 * A `base` effect that another package flags stays as it is.
 */
class Migration085NimbleEffectType extends MigrationBase {
	static override readonly version = 85;

	override readonly version = Migration085NimbleEffectType.version;

	override readonly title = 'Nimble effect type';

	override readonly kind: MigrationKind = 'structure';

	// The runner does not call updateEffect for the effects of an actor's items.
	override async updateItem(source: any): Promise<void> {
		for (const effect of source?.effects ?? []) await this.updateEffect(effect);
	}

	override async updateEffect(source: any): Promise<void> {
		if (!source || !needsNimbleType(source)) return;
		Object.assign(source, nimbleTypeChange(source));
	}
}

export { Migration085NimbleEffectType };
