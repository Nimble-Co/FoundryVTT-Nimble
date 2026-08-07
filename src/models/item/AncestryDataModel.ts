import { DEFAULT_SIZE } from '#utils/sizeSelection.js';

import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	exotic: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	// An ancestry always offers at least one size, so a new one starts at the default rather than
	// empty — otherwise the sheet would show a size the ancestry card does not.
	size: new fields.ArrayField(
		new fields.StringField({ required: true, initial: DEFAULT_SIZE, nullable: false }),
		{ required: true, nullable: false, initial: () => [DEFAULT_SIZE] },
	),
	// Names for the kinds of people this ancestry covers ("Dryad", "Shroomling"). Two or more
	// becomes a player choice during character creation, and the chosen name replaces the
	// ancestry's own on that character. Most ancestries cover one kind and list none.
	variants: new fields.ArrayField(
		new fields.StringField({ required: true, initial: '', nullable: false }),
		{ required: true, nullable: false, initial: () => [] },
	),
	// Compendium UUID of the ancestry's default bonus trait. Players may swap this for
	// any other ancestry bonus during character creation.
	defaultBonus: new fields.StringField({ required: true, initial: '', nullable: false }),
};

declare namespace NimbleAncestryData {
	type Schema = NimbleBaseItemData.Schema & typeof schema;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleAncestryData extends NimbleBaseItemData<
	NimbleAncestryData.Schema,
	NimbleAncestryData.BaseData,
	NimbleAncestryData.DerivedData
> {
	declare description: string;

	declare exotic: boolean;

	declare size: string[];

	declare variants: string[];

	declare defaultBonus: string;

	/** @inheritDoc */
	static override defineSchema(): NimbleAncestryData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleAncestryData };
