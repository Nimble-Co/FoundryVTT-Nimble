import { rules } from '../item/common.js';
import {
	CLOCKS,
	ESCAPE_SAVES,
	EVENT_SUBJECTS,
	LASTS_UNTIL_EVENTS,
	LASTS_UNTIL_KINDS,
	TIME_UNITS,
	TURN_BOUNDARIES,
	TURN_SPANS,
} from './nimbleEffectChoices.js';

const { fields } = foundry.data;

/**
 * AE V2 (Foundry V14) moved the document-level `changes` array into the type
 * data model: every ActiveEffect TypeDataModel must define a core-compatible
 * `changes` field or Game##verifyActiveEffectModels errors at world load and
 * force-extends the schema. This mirrors foundry.data.ActiveEffectTypeDataModel's
 * schema (that base class is not yet typed by fvtt-types); the verifier
 * requires an ArrayField of SchemaFields with string `type`/`phase` and
 * numeric `priority`.
 */
function validateChangeType(type: string): true {
	if (type.length < 3) throw new Error('must be at least three characters long');
	if (
		!/^custom\.-?\d+$/.test(type) &&
		!type.split('.').every((part) => /^[a-z0-9]+$/i.test(part))
	) {
		throw new Error(
			'A change type must either be a sequence of dot-delimited, alpha-numeric substrings or of the form "custom.{number}"',
		);
	}
	return true;
}

const changesSchema = () => ({
	changes: new fields.ArrayField(
		new fields.SchemaField({
			key: new fields.StringField({ required: true }),
			type: new fields.StringField({
				required: true,
				blank: false,
				initial: 'add',
				validate: validateChangeType,
			}),
			// fvtt-types does not declare `serializable`; core's form input needs it.
			value: new fields.AnyField({
				required: true,
				nullable: true,
				initial: '',
				...({ serializable: true } as object),
			}),
			phase: new fields.StringField({ required: true, blank: false, initial: 'initial' }),
			priority: new fields.NumberField(),
		}),
	),
});

const nullableChoice = (choices: readonly string[]) =>
	new fields.StringField({ required: true, nullable: true, initial: null, choices: [...choices] });

/** One moment that ends the effect. Fields that belong to another kind stay null or blank. */
const momentSchema = () =>
	new fields.SchemaField({
		kind: new fields.StringField({
			required: true,
			nullable: false,
			blank: false,
			initial: 'turn',
			choices: [...LASTS_UNTIL_KINDS],
		}),
		boundary: nullableChoice(TURN_BOUNDARIES),
		clock: nullableChoice(CLOCKS),
		span: nullableChoice(TURN_SPANS),
		value: new fields.NumberField({
			required: true,
			nullable: true,
			initial: null,
			integer: true,
			min: 1,
		}),
		units: nullableChoice(TIME_UNITS),
		who: nullableChoice(EVENT_SUBJECTS),
		event: nullableChoice(LASTS_UNTIL_EVENTS),
		effectName: new fields.StringField({ required: true, nullable: false, initial: '' }),
	});

const effectSchema = () => ({
	lastsUntil: new fields.ArrayField(momentSchema(), {
		required: true,
		nullable: false,
		initial: () => [],
	}),
	escape: new fields.SchemaField({
		dc: new fields.StringField({ required: true, nullable: false, blank: true, initial: '' }),
		saves: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, choices: [...ESCAPE_SAVES] }),
			{ required: true, nullable: false, initial: () => ['strength', 'dexterity'] },
		),
	}),
	tempHp: new fields.NumberField({
		required: true,
		nullable: true,
		initial: null,
		integer: true,
		min: 0,
	}),
	minor: new fields.BooleanField({ required: true, nullable: false, initial: false }),
	/** With no moments: the status's own Lasts Until does not apply, so only removing it ends it. */
	untilRemoved: new fields.BooleanField({ required: true, nullable: false, initial: false }),
});

declare namespace NimbleEffectData {
	type Schema = DataSchema &
		ReturnType<typeof changesSchema> &
		ReturnType<typeof rules> &
		ReturnType<typeof effectSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleEffectData extends foundry.abstract.TypeDataModel<
	NimbleEffectData.Schema,
	ActiveEffect.Implementation,
	NimbleEffectData.BaseData,
	NimbleEffectData.DerivedData
> {
	static override defineSchema(): NimbleEffectData.Schema {
		return {
			...changesSchema(),
			...rules(),
			...effectSchema(),
		};
	}
}

export { NimbleEffectData };
