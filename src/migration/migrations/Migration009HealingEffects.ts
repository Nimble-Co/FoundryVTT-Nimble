import { MigrationBase } from '../MigrationBase.js';

const HEALING_SALVE_SOURCE_ID = 'Compendium.nimble.class-features.Item.RLfAF3ftarBZBFF2';
const LAY_ON_HANDS_SOURCE_ID = 'Compendium.nimble.class-features.Item.Ddm1A7P01CcmPrim';
const SEARING_LIGHT_SOURCE_ID = 'Compendium.nimble.class-features.Item.KQiBYDr1BBTE0iJq';

const HEALING_SALVE_EFFECT = {
	id: 'HealingSalveEffect1',
	type: 'healing',
	healingType: 'healing',
	formula: '(@will)d6',
	parentContext: null,
	parentNode: null,
};

const LAY_ON_HANDS_EFFECT = {
	id: 'LayOnHandsHealing1',
	type: 'healing',
	healingType: 'healing',
	formula: '5*@level',
	parentContext: null,
	parentNode: null,
};

const SEARING_LIGHT_HEALING_EFFECT = {
	id: 'SearingLightHealing1',
	type: 'healing',
	healingType: 'healing',
	formula: '(@will)d8',
	parentContext: null,
	parentNode: null,
};

const SEARING_LIGHT_DAMAGE_EFFECT = {
	id: 'SearingLightDamage1',
	type: 'damage',
	damageType: 'radiant',
	formula: '(@will)d8',
	parentContext: null,
	parentNode: null,
	canCrit: false,
	canMiss: false,
};

/**
 * Migration to add healing effects to class features.
 *
 * This migration adds activation effects to:
 * - Healing Salve: healing effect with (@will)d6
 * - Lay on Hands: healing effect with 5*@level
 * - Searing Light: healing effect with (@will)d8 and damage effect with (@will)d8
 */
class Migration009HealingEffects extends MigrationBase {
	static override readonly version = 9;

	override readonly version = Migration009HealingEffects.version;

	override async updateItem(source: any): Promise<void> {
		// Only process feature items
		if (source.type !== 'feature') return;

		const sourceId = source.flags?.core?.sourceId;
		const name = source.name;

		// Handle Healing Salve
		if (sourceId === HEALING_SALVE_SOURCE_ID || name === 'Healing Salve') {
			this.#ensureActivationEffects(source);
			if (!this.#hasEffectById(source, 'HealingSalveEffect1')) {
				source.system.activation.effects.push(HEALING_SALVE_EFFECT);
				// Also update the cost type to action
				source.system.activation.cost.type = 'action';
				console.log(`Nimble Migration | ${name}: added Healing Salve healing effect`);
			}
			return;
		}

		// Handle Lay on Hands
		if (sourceId === LAY_ON_HANDS_SOURCE_ID || name === 'Lay on Hands') {
			this.#ensureActivationEffects(source);
			if (!this.#hasEffectById(source, 'LayOnHandsHealing1')) {
				source.system.activation.effects.push(LAY_ON_HANDS_EFFECT);
				// Also update the cost type to action
				source.system.activation.cost.type = 'action';
				console.log(`Nimble Migration | ${name}: added Lay on Hands healing effect`);
			}
			return;
		}

		// Handle Searing Light
		if (sourceId === SEARING_LIGHT_SOURCE_ID || name === 'Searing Light') {
			this.#ensureActivationEffects(source);
			if (!this.#hasEffectById(source, 'SearingLightHealing1')) {
				source.system.activation.effects.push(SEARING_LIGHT_HEALING_EFFECT);
				console.log(`Nimble Migration | ${name}: added Searing Light healing effect`);
			}
			if (!this.#hasEffectById(source, 'SearingLightDamage1')) {
				source.system.activation.effects.push(SEARING_LIGHT_DAMAGE_EFFECT);
				console.log(`Nimble Migration | ${name}: added Searing Light damage effect`);
			}
			return;
		}
	}

	#ensureActivationEffects(source: any): void {
		if (!source.system.activation) {
			source.system.activation = {};
		}
		if (!source.system.activation.effects) {
			source.system.activation.effects = [];
		}
	}

	#hasEffectById(source: any, effectId: string): boolean {
		return source.system.activation.effects.some((effect: any) => effect.id === effectId);
	}
}

export { Migration009HealingEffects };
