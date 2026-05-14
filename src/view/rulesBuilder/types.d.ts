/**
 * Prop types for the rules-builder UI feature. Co-located with the components
 * to keep the feature self-contained — see `AGENTS.md` Code Promotion Rules.
 *
 * Widgets read a current value and emit changes through `onChange`. The
 * `<SchemaFieldRenderer>` is responsible for translating between the rule's
 * schema shape and these props — widgets stay generic and don't know about
 * rules.
 */

import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';
import type { Predicate, RawPredicate } from '../../etc/Predicate.js';

export interface RuleSource {
	id: string;
	type: string;
	label?: string;
	disabled?: boolean;
	[key: string]: unknown;
}

export interface RulesBuilderWindowProps {
	document: NimbleBaseItem;
}

export interface SchemaFieldRendererProps {
	/** The Foundry schema field — output of `defineSchema()` for a rule. */
	field: foundry.data.fields.DataField.Any;
	/** Current value at this field. */
	value: unknown;
	/** Full rule data — used to evaluate `field.showWhen` against siblings. */
	parentData: Record<string, unknown>;
	/** Emit a new value for this field. The parent merges it into the rule. */
	onChange: (next: unknown) => void;
	/** Field name (for label fallback and the inline-error block). */
	name: string;
	/** Disabled state (read-only mode). */
	disabled?: boolean;
}

export interface FormulaInputProps {
	value: string;
	onChange: (next: string) => void;
	placeholder?: string;
	disabled?: boolean;
	dice?: boolean;
}

export interface DocumentPickerProps {
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
	/** Restricts drop acceptance — e.g. `['Item']` or `['Item.spell']`. */
	documentTypes?: string[];
	placeholder?: string;
}

export interface RichTextEditorProps {
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

export interface PredicateBuilderProps {
	value: RawPredicate;
	onChange: (next: RawPredicate) => void;
	/**
	 * Optional domain to render the "currently matches" preview against. When
	 * omitted, the preview is suppressed (the builder is in a context with no
	 * parent actor — e.g. unowned compendium item).
	 */
	previewDomain?: Set<string>;
}

export interface RuleCardProps {
	/** The reactive rule source object — typed loosely so the card stays generic. */
	rule: Record<string, unknown>;
	/** RulesManager instance bound to the parent item. */
	manager: { updateRule: (id: string, data: Record<string, unknown>) => Promise<unknown> };
	/** Parent actor's tag domain, used to surface typeahead suggestions and a live
	 *  match preview in `<PredicateBuilder>`. Undefined for unowned items. */
	previewDomain?: Set<string>;
	onDelete?: () => void;
	/** Hide the body + advanced section, keeping just the header visible. */
	collapsed?: boolean;
	onToggleCollapse?: () => void;
}

export interface RuleTypePickerProps {
	onPick: (ruleKey: string) => void;
	disabled?: boolean;
}

export type { WidgetHint } from '../../models/rules/_widgetOption.js';

export type { Predicate, RawPredicate };
