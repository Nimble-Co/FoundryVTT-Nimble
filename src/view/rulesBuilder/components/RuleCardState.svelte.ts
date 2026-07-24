import { untrack } from 'svelte';
import localize from '#utils/localize.js';
import type { RuleCardProps } from '#view/rulesBuilder/types.js';

export const FIXED_FIELDS = new Set([
	'id',
	'type',
	'disabled',
	'identifier',
	'label',
	'priority',
	'predicate',
	'suppressActivationCard',
]);

export function createRuleCardState(
	getRule: () => Record<string, unknown>,
	getManager: () => RuleCardProps['manager'],
) {
	const { ruleDataModels, ruleTypes } = CONFIG.NIMBLE;
	const RuleClass = $derived(ruleDataModels[getRule().type as string]);
	// Data-aware: dual-phase rules (e.g. speedBonus with a formula value) only
	// evaluate their predicate in prePrepareData for some values, so pass the rule
	// data rather than reading the class-level flag.
	const appliesInPrePrepareData = $derived(
		Boolean(
			(
				RuleClass as
					| { appliesInPrePrepareDataFor?: (data: Record<string, unknown>) => boolean }
					| undefined
			)?.appliesInPrePrepareDataFor?.(getRule() as unknown as Record<string, unknown>),
		),
	);
	const ruleLabel = $derived(
		(getRule().label as string) ||
			localize(ruleTypes[getRule().type as string] ?? (getRule().type as string)),
	);

	// `defineSchema()` allocates fresh field instances on every call. The
	// schema only depends on `rule.type`, so memoize per-type to avoid
	// rebuilding the field tree on every keystroke.
	const schemaCache = new Map<string, Record<string, foundry.data.fields.DataField.Any> | null>();
	const schema = $derived.by(() => {
		const type = getRule().type as string;
		if (schemaCache.has(type)) return schemaCache.get(type) ?? null;
		const cls = ruleDataModels[type];
		if (!cls) {
			schemaCache.set(type, null);
			return null;
		}
		try {
			const built = cls.defineSchema() as Record<string, foundry.data.fields.DataField.Any>;
			schemaCache.set(type, built);
			return built;
		} catch (err) {
			console.warn(`Nimble | RuleCard could not load schema for "${type}"`, err);
			schemaCache.set(type, null);
			return null;
		}
	});

	let showJson = $state(false);
	let jsonDraft = $state(untrack(() => JSON.stringify(getRule(), null, 2)));
	let jsonError = $state<string | null>(null);
	let lastSerialized = $state(untrack(() => JSON.stringify(getRule())));

	function setupJsonSyncEffect(): void {
		$effect(() => {
			const next = JSON.stringify(getRule());
			if (next !== lastSerialized) {
				lastSerialized = next;
				if (!showJson) jsonDraft = JSON.stringify(getRule(), null, 2);
			}
		});
	}

	async function emitFieldChange(name: string, value: unknown) {
		const rule = getRule();
		await getManager().updateRule(rule.id as string, { ...rule, [name]: value });
	}

	function toggleJson() {
		if (!showJson) {
			jsonDraft = JSON.stringify(getRule(), null, 2);
			jsonError = null;
		}
		showJson = !showJson;
	}

	async function commitJson() {
		try {
			const parsed = JSON.parse(jsonDraft);
			await getManager().updateRule(getRule().id as string, parsed);
			jsonError = null;
		} catch (err) {
			jsonError = err instanceof Error ? err.message : 'Invalid JSON';
		}
	}

	async function toggleDisabled() {
		await emitFieldChange('disabled', !getRule().disabled);
	}

	function setJsonDraft(next: string) {
		jsonDraft = next;
	}

	const warnedMissingLabel = new Set<string>();

	/**
	 * Display label for a schema field. Foundry's existing `label` option
	 * wins; otherwise convert the camelCase property name into a readable
	 * "Camel Case" string ("damageType" → "Damage Type"). The fallback is
	 * English-only, so dev mode warns once per (type, field) pair to flag
	 * the i18n trap.
	 */
	function fieldLabel(name: string, field: foundry.data.fields.DataField.Any): string {
		const explicit = (field as { label?: string }).label;
		if (explicit) return localize(explicit);
		const ruleType = getRule().type as string;
		const key = `${ruleType}.${name}`;
		if (!warnedMissingLabel.has(key)) {
			warnedMissingLabel.add(key);
			console.warn(
				`Nimble | RuleCard: rule "${ruleType}" field "${name}" has no \`label:\` ` +
					`option. Falling back to a camelCase-derived English-only label.`,
			);
		}
		return name
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, (c) => c.toUpperCase())
			.trim();
	}

	/** Read Foundry's `hint` option from a field, localized if present. */
	function fieldHint(field: foundry.data.fields.DataField.Any): string {
		const hint = (field as { hint?: string }).hint;
		if (!hint) return '';
		return localize(hint);
	}

	return {
		ruleTypes,
		get RuleClass() {
			return RuleClass;
		},
		get appliesInPrePrepareData() {
			return appliesInPrePrepareData;
		},
		get ruleLabel() {
			return ruleLabel;
		},
		get schema() {
			return schema;
		},
		get showJson() {
			return showJson;
		},
		get jsonDraft() {
			return jsonDraft;
		},
		get jsonError() {
			return jsonError;
		},
		setJsonDraft,
		setupJsonSyncEffect,
		emitFieldChange,
		toggleJson,
		commitJson,
		toggleDisabled,
		fieldLabel,
		fieldHint,
	};
}
