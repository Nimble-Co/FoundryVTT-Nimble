/** A rule as it is stored on an item's `system.rules`. */
export interface RuleSource {
	id: string;
	type: string;
	disabled?: boolean;
	[key: string]: string | number | boolean | object | null | undefined;
}
