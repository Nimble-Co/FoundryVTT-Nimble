import { NimbleBaseItemData } from './BaseItemDataModel.js';
import { activation } from './common.js';

const { fields } = foundry.data;

const MONSTER_FEATURE_SUBTYPES = {
	feature: 'NIMBLE.monsterFeatureSubtypes.feature',
	action: 'NIMBLE.monsterFeatureSubtypes.action',
	attackSequence: 'NIMBLE.monsterFeatureSubtypes.attackSequence',
	bloodied: 'NIMBLE.monsterFeatureSubtypes.bloodied',
	lastStand: 'NIMBLE.monsterFeatureSubtypes.lastStand',
};

const schema = () => ({
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	subtype: new fields.StringField({
		required: true,
		initial: 'feature',
		nullable: false,
		choices: MONSTER_FEATURE_SUBTYPES,
	}),
	// Reference to parent attackSequence item (for grouping actions under attack sequences)
	parentItemId: new fields.StringField({ required: false, initial: '', nullable: true }),
	// Heal target used by the Last Stand mechanic. Meaningful only when subtype === 'lastStand';
	// when the actor's HP would drop to 0, the health-state sync heals to this value, applies
	// the lastStand and dying conditions, and fires a GM chat card. 0 disables the mechanic.
	lastStandHp: new fields.NumberField({
		required: true,
		initial: 0,
		nullable: false,
		integer: true,
		min: 0,
	}),
});

declare namespace NimbleMonsterFeatureData {
	type Schema = NimbleBaseItemData.Schema &
		ReturnType<typeof activation> &
		ReturnType<typeof schema>;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleMonsterFeatureData extends NimbleBaseItemData<
	NimbleMonsterFeatureData.Schema,
	NimbleMonsterFeatureData.BaseData,
	NimbleMonsterFeatureData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleMonsterFeatureData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleMonsterFeatureData };
