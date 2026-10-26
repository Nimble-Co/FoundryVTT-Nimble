import type { ResolvedFormGroup } from '#view/rulesBuilder/types.js';
import type { RuleFormGroup } from '../../../models/rules/_formLayout.js';
import { isFieldShown } from './isFieldShown.js';

type DataField = foundry.data.fields.DataField.Any;

/**
 * Turns a rule's `formLayout` into the groups to show for the current data.
 * Hidden fields and empty groups drop out. A group with no label takes its
 * question from its first shown field, unless that field is a checkbox.
 * Editable fields the layout does not name follow in one last group, so a
 * new schema field is never lost.
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

		const [first] = fields;
		if (group.label || !first || first.isBoolean) return [{ ...group, fields }];

		first.showLabel = false;
		return [{ ...group, labelField: first, fields }];
	});
}
