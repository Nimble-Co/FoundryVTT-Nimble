<script lang="ts">
	import { untrack } from 'svelte';
	import type { RawPredicate } from '../../../etc/Predicate.js';
	import localize from '#utils/localize.js';
	import overrideTextAreaBehavior from '#utils/overrideTextAreaBehavior.js';
	import type { RuleCardProps } from '#view/rulesBuilder/types.js';
	import PredicateBuilder from './PredicateBuilder.svelte';
	import SchemaFieldRenderer from './SchemaFieldRenderer.svelte';

	let {
		rule,
		manager,
		previewDomain,
		onDelete,
		collapsed = false,
		onToggleCollapse,
	}: RuleCardProps = $props();

	const { ruleDataModels, ruleTypes } = CONFIG.NIMBLE;
	const RuleClass = $derived(ruleDataModels[rule.type as string]);
	const ruleLabel = $derived(
		(rule.label as string) || localize(ruleTypes[rule.type as string] ?? (rule.type as string)),
	);

	// `defineSchema()` allocates fresh field instances on every call. The
	// schema only depends on `rule.type`, so memoize per-type to avoid
	// rebuilding the field tree on every keystroke.
	const schemaCache = new Map<string, Record<string, foundry.data.fields.DataField.Any> | null>();
	const schema = $derived.by(() => {
		const type = rule.type as string;
		if (schemaCache.has(type)) return schemaCache.get(type) ?? null;
		if (!RuleClass) {
			schemaCache.set(type, null);
			return null;
		}
		try {
			const built = RuleClass.defineSchema() as Record<string, foundry.data.fields.DataField.Any>;
			schemaCache.set(type, built);
			return built;
		} catch (err) {
			console.warn(`Nimble | RuleCard could not load schema for "${type}"`, err);
			schemaCache.set(type, null);
			return null;
		}
	});

	let showJson = $state(false);
	let jsonDraft = $state(untrack(() => JSON.stringify(rule, null, 2)));
	let jsonError = $state<string | null>(null);

	let lastSerialized = $state(untrack(() => JSON.stringify(rule)));
	$effect(() => {
		const next = JSON.stringify(rule);
		if (next !== lastSerialized) {
			lastSerialized = next;
			if (!showJson) jsonDraft = JSON.stringify(rule, null, 2);
		}
	});

	async function emitFieldChange(name: string, value: unknown) {
		await manager.updateRule(rule.id as string, { ...rule, [name]: value });
	}

	function toggleJson() {
		if (!showJson) {
			jsonDraft = JSON.stringify(rule, null, 2);
			jsonError = null;
		}
		showJson = !showJson;
	}

	async function commitJson() {
		try {
			const parsed = JSON.parse(jsonDraft);
			await manager.updateRule(rule.id as string, parsed);
			jsonError = null;
		} catch (err) {
			jsonError = err instanceof Error ? err.message : 'Invalid JSON';
		}
	}

	async function toggleDisabled() {
		await emitFieldChange('disabled', !rule.disabled);
	}

	const FIXED_FIELDS = new Set([
		'id',
		'type',
		'disabled',
		'identifier',
		'label',
		'priority',
		'predicate',
	]);

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
		const key = `${rule.type}.${name}`;
		if (!warnedMissingLabel.has(key)) {
			warnedMissingLabel.add(key);
			console.warn(
				`Nimble | RuleCard: rule "${rule.type}" field "${name}" has no \`label:\` ` +
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
</script>

<article
	class="nimble-rule-card"
	class:nimble-rule-card--disabled={Boolean(rule.disabled)}
	class:nimble-rule-card--collapsed={collapsed}
>
	<header class="nimble-rule-card__header">
		{#if onToggleCollapse}
			<button
				type="button"
				class="nimble-button nimble-rule-card__chevron"
				data-button-variant="icon"
				aria-expanded={!collapsed}
				aria-label={collapsed ? 'Expand rule' : 'Collapse rule'}
				data-tooltip={collapsed ? 'Expand' : 'Collapse'}
				onclick={onToggleCollapse}
			>
				<i class="fa-solid {collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
			</button>
		{/if}

		<input
			class="nimble-rule-card__label"
			type="text"
			value={rule.label as string}
			placeholder={ruleLabel}
			onchange={(e) => emitFieldChange('label', (e.target as HTMLInputElement).value)}
		/>

		<span class="nimble-rule-card__type">{ruleTypes[rule.type as string] ?? rule.type}</span>

		<label
			class="nimble-rule-card__priority"
			data-tooltip="Application order during data prep. Lower numbers run first."
		>
			<span class="nimble-rule-card__priority-label">Priority</span>
			<input
				type="number"
				class="nimble-rule-card__priority-input"
				value={(rule.priority as number) ?? 1}
				onchange={(e) => {
					const num = parseInt((e.target as HTMLInputElement).value, 10);
					if (!Number.isNaN(num)) emitFieldChange('priority', num);
				}}
			/>
		</label>

		{#if RuleClass}
			<i
				class="nimble-rule-card__help fa-solid fa-circle-question"
				data-tooltip={localize(
					(RuleClass as unknown as { description?: string }).description ?? '',
				)}
				data-tooltip-direction="UP"
			></i>
		{:else}
			<i
				class="nimble-rule-card__help fa-solid fa-circle-exclamation"
				data-tooltip={`Unknown rule type: ${rule.type}`}
				data-tooltip-direction="UP"
				style="color: var(--color-level-error);"
			></i>
		{/if}

		<div class="nimble-rule-card__controls">
			<button
				type="button"
				class="nimble-button"
				data-button-variant="icon"
				data-tooltip={rule.disabled ? 'Enable rule' : 'Disable rule'}
				aria-label={rule.disabled ? 'Enable rule' : 'Disable rule'}
				onclick={toggleDisabled}
			>
				<i class="fa-solid {rule.disabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
			</button>

			<button
				type="button"
				class="nimble-button"
				data-button-variant="icon"
				data-tooltip={showJson ? 'Switch to builder' : 'Edit raw JSON'}
				aria-label={showJson ? 'Switch to builder' : 'Edit raw JSON'}
				onclick={toggleJson}
			>
				<i class="fa-solid {showJson ? 'fa-list' : 'fa-code'}"></i>
			</button>

			{#if onDelete}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="icon"
					data-tooltip="Delete rule"
					aria-label="Delete rule"
					onclick={onDelete}
				>
					<i class="fa-solid fa-trash"></i>
				</button>
			{/if}
		</div>
	</header>

	{#if !collapsed}
		{#if showJson}
			<div class="nimble-rule-card__json">
				<textarea
					class="nimble-code-block__text-area"
					bind:value={jsonDraft}
					rows="11"
					autocapitalize="off"
					autocomplete="off"
					spellcheck="false"
					wrap="soft"
					onkeydown={overrideTextAreaBehavior}
				></textarea>
				<div class="nimble-rule-card__json-controls">
					<button
						type="button"
						class="nimble-button"
						data-button-variant="basic"
						onclick={commitJson}
					>
						<i class="fa-solid fa-save"></i>
						Save JSON
					</button>
					{#if jsonError}
						<span class="nimble-rule-card__json-error">{jsonError}</span>
					{/if}
				</div>
			</div>
		{:else if !schema}
			<p class="nimble-rule-card__empty">
				{@html localize('NIMBLE.rulesBuilder.errorSchemaLoad', { type: rule.type as string })}
			</p>
		{:else}
			{@const editableEntries = Object.entries(schema).filter(
				([fieldName]) => !FIXED_FIELDS.has(fieldName),
			)}
			<div class="nimble-rule-card__body">
				{#if editableEntries.length === 0}
					<p class="nimble-rule-card__empty">No further configuration needed.</p>
				{:else}
					{#each editableEntries as [fieldName, field] (fieldName)}
						{@const hint = fieldHint(field)}
						<div class="nimble-field-row">
							<span class="nimble-field-row__label">{fieldLabel(fieldName, field)}</span>
							<SchemaFieldRenderer
								{field}
								value={rule[fieldName]}
								parentData={rule}
								name={fieldName}
								onChange={(v) => emitFieldChange(fieldName, v)}
							/>
							{#if hint}
								<small class="nimble-field-row__hint">{hint}</small>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<details class="nimble-rule-card__advanced">
				<summary>
					<i class="fa-solid fa-sliders"></i>
					Advanced
				</summary>

				<div class="nimble-rule-card__advanced-body">
					<label class="nimble-field-row">
						<span class="nimble-field-row__label">Identifier</span>
						<input
							type="text"
							value={(rule.identifier as string) ?? ''}
							onchange={(e) => emitFieldChange('identifier', (e.target as HTMLInputElement).value)}
						/>
					</label>

					<div class="nimble-field-row">
						<span class="nimble-field-row__label">Applies when</span>
						<PredicateBuilder
							value={(rule.predicate as RawPredicate) ?? {}}
							onChange={(v) => emitFieldChange('predicate', v)}
							{previewDomain}
						/>
					</div>
				</div>
			</details>
		{/if}
	{/if}
</article>

<style lang="scss">
	.nimble-rule-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
		background: var(--nimble-sheet-background);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 6px;

		&--disabled {
			opacity: 0.6;
		}

		&--collapsed {
			gap: 0;
		}

		&__header {
			display: flex;
			gap: 0.375rem;
			align-items: center;
		}

		&__chevron {
			color: var(--color-text-dark-secondary);
			flex-shrink: 0;
		}

		&__priority {
			display: inline-flex;
			gap: 0.25rem;
			align-items: center;
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-xs-text);
			color: var(--color-text-dark-secondary);
			background: var(--nimble-box-background-color);
			border-radius: 4px;
		}

		&__priority-label {
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}

		&__priority-input {
			width: 3rem;
			padding: 0 0.25rem;
			font-size: var(--nimble-xs-text);
			text-align: center;
			background: var(--nimble-sheet-background, transparent);
			border: 1px solid var(--nimble-accent-color);
			border-radius: 3px;
		}

		&__label {
			flex-grow: 1;
			padding: 0.25rem 0.375rem;
			font-weight: 600;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 4px;

			&:focus,
			&:hover {
				background: var(--nimble-box-background-color);
				border-color: var(--nimble-accent-color);
			}
		}

		&__type {
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-xs-text);
			color: var(--color-text-dark-secondary);
			background: var(--nimble-box-background-color);
			border-radius: 4px;
		}

		&__controls {
			display: flex;
			gap: 0.125rem;
		}

		&__body {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__empty {
			margin: 0;
			padding: 0.5rem;
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-sm-text);
			font-style: italic;
			text-align: center;
		}

		&__advanced {
			padding: 0.375rem 0.5rem;
			background: var(--nimble-box-background-color);
			border-radius: 4px;

			summary {
				cursor: pointer;
				font-size: var(--nimble-sm-text);
				font-weight: 600;
			}

			&-body {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				margin-top: 0.5rem;
			}
		}

		&__json {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__json-controls {
			display: flex;
			gap: 0.5rem;
			align-items: center;
		}

		&__json-error {
			color: var(--color-level-error);
			font-size: var(--nimble-xs-text);
		}

		&__help {
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-sm-text);
		}
	}

	.nimble-field-row {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--color-text-dark-secondary);
		}

		&__hint {
			margin-top: 0.0625rem;
			font-size: var(--nimble-xs-text);
			color: var(--color-text-dark-secondary);
			line-height: 1.3;
		}
	}

	.nimble-code-block__text-area {
		width: 100%;
		font-family: var(--nimble-font-monospace, monospace);
		font-size: var(--nimble-sm-text);
		background: var(--nimble-box-background-color);
		color: inherit;
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;
	}
</style>
