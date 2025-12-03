/* eslint-disable max-classes-per-file */
import { isValidDiceModifier } from '../../../utils/isValidDiceModifier.js';
import { identifier } from '../../common.js';

/** ---------------------------------------------------------- */

// Base schema type for resources
type BaseResourceSchema = ReturnType<typeof baseResourceSchema>;

// Parent type for resource models - use structural interface since NimbleClassItem is a type-only import
type ResourceParent = foundry.abstract.DataModel.Any;

function baseResourceSchema() {
	const { fields } = foundry.data;

	return {
		name: new fields.StringField({ required: true, nullable: false, initial: '' }),
		...identifier(),
		consumable: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		recovery: new fields.SchemaField({
			on: new fields.StringField({ required: true, nullable: false, initial: 'safeRest' }),
		}),
	};
}

declare namespace NimbleBaseResource {
	type Schema = BaseResourceSchema;
}

abstract class NimbleBaseResource<
	Schema extends NimbleBaseResource.Schema = NimbleBaseResource.Schema,
	Parent extends ResourceParent = ResourceParent,
> extends foundry.abstract.DataModel<Schema, Parent> {
	declare type: string;

	constructor(
		source: foundry.data.fields.SchemaField.InnerAssignmentType<Schema>,
		options?: { parent?: Parent; strict?: boolean },
	) {
		super(source as never, { parent: options?.parent, strict: options?.strict ?? true });
	}

	static override defineSchema(): NimbleBaseResource.Schema {
		return {
			...baseResourceSchema(),
		};
	}
}

/** ---------------------------------------------------------- */

function numericalResourceSchema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
		max: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'numerical' }),
		levels: new fields.SchemaField(
			Array.from({ length: 20 }, (_, i) => i + 1).reduce((acc, level) => {
				acc[level] = new fields.StringField({ required: true, initial: '' });
				return acc;
			}, {}),
		),
	};
}

declare namespace NimbleNumericalResource {
	type Schema = NimbleBaseResource.Schema & ReturnType<typeof numericalResourceSchema>;
}

class NimbleNumericalResource<
	Schema extends NimbleNumericalResource.Schema = NimbleNumericalResource.Schema,
	Parent extends ResourceParent = ResourceParent,
> extends NimbleBaseResource<Schema, Parent> {
	static override defineSchema(): NimbleNumericalResource.Schema {
		return {
			...NimbleBaseResource.defineSchema(),
			...numericalResourceSchema(),
		};
	}
}

/** ---------------------------------------------------------- */

function counterResourceSchema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
		max: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'counter' }),
		levels: new fields.SchemaField(
			Array.from({ length: 20 }, (_, i) => i + 1).reduce((acc, level) => {
				acc[level] = new fields.StringField({ required: true, initial: '' });
				return acc;
			}, {}),
		),
	};
}

declare namespace NimbleCounterResource {
	type Schema = NimbleBaseResource.Schema & ReturnType<typeof counterResourceSchema>;
}

class NimbleCounterResource<
	Schema extends NimbleCounterResource.Schema = NimbleCounterResource.Schema,
	Parent extends ResourceParent = ResourceParent,
> extends NimbleBaseResource<Schema, Parent> {
	static override defineSchema(): NimbleCounterResource.Schema {
		return {
			...NimbleBaseResource.defineSchema(),
			...counterResourceSchema(),
		};
	}
}

/** ---------------------------------------------------------- */

function diceResourceSchema() {
	const { fields } = foundry.data;

	return {
		faces: new fields.NumberField({ required: true, nullable: false, initial: 6 }),
		quantity: new fields.NumberField({ required: true, nullable: false, initial: 1 }),
		modifiers: new fields.SetField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{ required: true, nullable: false },
		),
		isPool: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		poolQuantity: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'dice' }),
		levels: new fields.SchemaField(
			Array.from({ length: 20 }, (_, i) => i + 1).reduce((acc, level) => {
				acc[level] = new fields.SchemaField({
					face: new fields.NumberField({ required: true, nullable: false, initial: 6 }),
					quantity: new fields.NumberField({ required: true, nullable: false, initial: 1 }),
					modifiers: new fields.SetField(
						new fields.StringField({ required: true, nullable: false, initial: '' }),
						{ required: true, nullable: false },
					),
				});
				return acc;
			}, {}),
		),
	};
}

declare namespace NimbleDiceResource {
	type Schema = NimbleBaseResource.Schema & ReturnType<typeof diceResourceSchema>;
}

class NimbleDiceResource<
	Schema extends NimbleDiceResource.Schema = NimbleDiceResource.Schema,
	Parent extends ResourceParent = ResourceParent,
> extends NimbleBaseResource<Schema, Parent> {
	declare faces: number;

	declare quantity: number;

	declare modifiers: Set<string>;

	static override defineSchema(): NimbleDiceResource.Schema {
		return {
			...NimbleBaseResource.defineSchema(),
			...diceResourceSchema(),
		};
	}

	get denom(): string {
		if (!this.faces) return '';
		return `d${this.faces}`;
	}

	get formula(): string {
		if (!this.faces) return '';

		return `${this.quantity || 1}d${this.faces || 6}${this.mods}`;
	}

	get mods(): string {
		if (!this.modifiers) return '';
		return this.modifiers.reduce((acc, mod) => acc + (isValidDiceModifier(mod) ? mod : ''), '');
	}

	static FACES = [2, 3, 4, 6, 8, 12, 20, 100];
}

/** ---------------------------------------------------------- */

export const ResourceDataModels = {
	base: NimbleBaseResource,
	counter: NimbleCounterResource,
	dice: NimbleDiceResource,
	numerical: NimbleNumericalResource,
} as const;

export { NimbleBaseResource, NimbleCounterResource, NimbleDiceResource, NimbleNumericalResource };
