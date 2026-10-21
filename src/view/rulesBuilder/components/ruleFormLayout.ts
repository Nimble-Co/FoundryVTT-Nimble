import type { RuleFormGroup } from '../../../models/rules/_formLayout.js';
import { isFieldShown } from './isFieldShown.js';

type DataField = foundry.data.fields.DataField.Any;

export interface ResolvedFormField {
	name: string;
	field: DataField;
	isBoolean: boolean;
	/** False when the group heading already is this field's label. */
	showLabel: boolean;
}

export interface ResolvedFormGroup {
	key: string;
	/** Lang key of the group question, when the layout gives one. */
	label?: string;
	/** Field whose label is the group question, when the layout gives none. */
	labelField?: ResolvedFormField;
	hint?: string;
	fields: ResolvedFormField[];
}

/**
 * Turns a rule's `formLayout` into the groups to show for the current data.
 * Hidden fields and empty groups drop out. Editable fields the layout does
 * not name follow in one last group, so a new schema field is never lost.
 */
export function resolveFormGroups(
	layout: readonly RuleFormGroup[],
	schema: Record<string, DataField>,
	data: Record<string, unknown>,
	fixedFields: ReadonlySet<string>,
): ResolvedFormGroup[] {
	const { BooleanField } = foundry.data.fields;
	const placed = new Set<string>();

	const groups: Array<Omit<ResolvedFormGroup, 'labelField'> & { names: string[] }> = layout.map(
		(group, index) => {
			const names = group.fields.filter((name) => name in schema);
			for (const name of names) placed.add(name);
			return { key: `group-${index}`, label: group.label, hint: group.hint, names, fields: [] };
		},
	);

	const rest = Object.keys(schema).filter((name) => !fixedFields.has(name) && !placed.has(name));
	if (rest.length > 0) groups.push({ key: 'rest', names: rest, fields: [] });

	return groups.flatMap(({ names, ...group }) => {
		const fields = names
			.map((name) => ({ name, field: schema[name] as DataField }))
			.filter(({ field }) => isFieldShown(field, data))
			.map(({ name, field }) => ({
				name,
				field,
				isBoolean: field instanceof BooleanField,
				showLabel: true,
			}));
		if (fields.length === 0) return [];

		const only = fields.length === 1 ? fields[0] : undefined;
		if (group.label || !only || only.isBoolean) return [{ ...group, fields }];

		only.showLabel = false;
		return [{ ...group, labelField: only, fields }];
	});
}
