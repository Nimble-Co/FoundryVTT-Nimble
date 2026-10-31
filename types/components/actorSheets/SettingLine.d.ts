import type { Snippet } from 'svelte';

export interface SettingLineProps {
	label: string;
	/** one short help line under the label */
	hint?: string;
	/** the id of the control; the label points to it and the hint gets `${id}-hint`. No id: a value you only read */
	id?: string;
	/** the control, at the right: a `.value` field or text, or an `input[role=switch]` */
	children: Snippet;
}
