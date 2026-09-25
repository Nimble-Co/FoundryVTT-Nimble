import type {
	ContainerConfig,
	ContainerSlotCostMode,
	ObjectSizeType,
} from '#types/inventoryContainers.js';
import { NimbleBaseItemData } from './BaseItemDataModel.js';
import { activation, baseProperties } from './common.js';

const { fields } = foundry.data;

/** The slot cost modes a container can be set to, in the order the sheet offers them. */
export const CONTAINER_SLOT_COST_MODES: readonly ContainerSlotCostMode[] = [
	'none',
	'ignore',
	'reduce',
	'half',
];

/** The ways an object can occupy inventory space. */
export const OBJECT_SIZE_TYPES: readonly ObjectSizeType[] = ['slots', 'stackable', 'smallSized'];

const schema = () => ({
	description: new fields.SchemaField({
		public: new fields.HTMLField({ required: true, initial: '', nullable: false }),
		unidentified: new fields.HTMLField({ required: true, initial: '', nullable: false }),
		secret: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	}),
	identified: new fields.BooleanField({ required: true, nullable: false, initial: true }),
	objectType: new fields.StringField({ required: true, initial: '', nullable: false }),
	/**
	 * The weapon's type identifier (e.g. "Longsword", "Greatsword"). Used for
	 * the per-weapon proficiency check that suppresses crits when the wielder
	 * lacks proficiency with the weapon's type. Empty string is the permissive
	 * default — no proficiency check is applied. Existing weapon items that
	 * have not been migrated keep this empty and behave unchanged.
	 */
	weaponType: new fields.StringField({ required: true, initial: '', nullable: false }),
	price: new fields.SchemaField({
		value: new fields.NumberField({
			required: true,
			initial: 0,
			nullable: false,
			min: 0,
		}),
		denomination: new fields.StringField({
			required: true,
			initial: 'gp',
			nullable: false,
			choices: ['cp', 'sp', 'gp'],
		}),
	}),
	quantity: new fields.NumberField({
		required: true,
		initial: 1,
		nullable: false,
		min: 0,
	}),
	equipped: new fields.BooleanField({
		required: true,
		initial: false,
		nullable: false,
	}),
	unidentifiedName: new fields.StringField({
		required: true,
		initial: 'Unidentified Object',
		nullable: false,
	}),
	objectSizeType: new fields.StringField({
		required: true,
		initial: 'slots',
		nullable: false,
		choices: OBJECT_SIZE_TYPES,
	}),
	slotsRequired: new fields.NumberField({
		required: true,
		initial: 0,
		min: 0,
		nullable: false,
	}),
	/** Slots the object takes while it is not equipped. Null costs the same either way. */
	stowedSlotsRequired: new fields.NumberField({
		required: true,
		initial: null,
		min: 0,
		nullable: true,
	}),
	stackSize: new fields.NumberField({
		required: true,
		initial: 2,
		min: 2,
		nullable: false,
	}),
	/** Id of the container object on the same actor that holds this one. Empty when carried directly. */
	containerId: new fields.StringField({ required: true, initial: '', nullable: false }),
	container: new fields.SchemaField({
		enabled: new fields.BooleanField({ required: true, initial: false, nullable: false }),
		slotCostMode: new fields.StringField({
			required: true,
			initial: 'none',
			nullable: false,
			choices: CONTAINER_SLOT_COST_MODES,
		}),
		slotCostReduction: new fields.NumberField({
			required: true,
			initial: 1,
			min: 0,
			nullable: false,
		}),
		capacity: new fields.NumberField({ required: true, initial: null, min: 0, nullable: true }),
		allowedObjectTypes: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{ required: true, nullable: false, initial: [] },
		),
		requiresEquipped: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	}),
	properties: new fields.SchemaField({
		...baseProperties(),
		selected: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{
				required: true,
				nullable: false,
				initial: [],
				options: [
					'concentration',
					'light',
					'load',
					'range',
					'reach',
					'thrown',
					'twoHanded',
					'vicious',
				],
			},
		),
		strengthRequirement: new fields.SchemaField({
			value: new fields.NumberField({ required: true, nullable: true, initial: null }),
			overridesTwoHanded: new fields.BooleanField({
				required: true,
				initial: false,
				nullable: false,
			}),
		}),
		thrownRange: new fields.NumberField({ required: true, nullable: false, initial: 4 }),
	}),
});

declare namespace NimbleObjectData {
	type Schema = NimbleBaseItemData.Schema &
		ReturnType<typeof activation> &
		ReturnType<typeof schema>;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleObjectData extends NimbleBaseItemData<
	NimbleObjectData.Schema,
	NimbleObjectData.BaseData,
	NimbleObjectData.DerivedData
> {
	// Schema-defined properties
	declare activation: {
		showDescription: boolean;
		skipRollDialog: boolean;
		acquireTargetsFromTemplate: boolean;
		cost: { details: string; quantity: number; type: string; isReaction: boolean };
		duration: { details: string; quantity: number; type: string };
		effects: Record<string, unknown>[];
		targets: {
			count: number;
			restrictions: string;
			attackType: '' | 'reach' | 'range';
			distance: number;
		};
		template: { length: number; radius: number; shape: string; width: number };
	};

	declare description: {
		public: string;
		unidentified: string;
		secret: string;
	};
	declare identified: boolean;
	declare objectType: string;
	declare weaponType: string;
	declare price: {
		value: number;
		denomination: 'cp' | 'sp' | 'gp';
	};
	declare quantity: number;
	declare equipped: boolean;
	declare unidentifiedName: string;
	declare objectSizeType: ObjectSizeType;
	declare slotsRequired: number;
	declare stowedSlotsRequired: number | null;
	declare stackSize: number;
	declare containerId: string;
	declare container: ContainerConfig;
	declare properties: {
		reach: { min: number; max: number | null };
		range: { min: number; max: number | null };
		selected: string[];
		strengthRequirement: {
			value: number | null;
			overridesTwoHanded: boolean;
		};
		thrownRange: number;
	};

	/** @inheritDoc */
	static override defineSchema(): NimbleObjectData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleObjectData };
