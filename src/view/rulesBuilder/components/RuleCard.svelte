<script lang="ts">
	import type { RawPredicate } from '../../../etc/Predicate.js';
	import localize from '#utils/localize.js';
	import overrideTextAreaBehavior from '#utils/overrideTextAreaBehavior.js';
	import type { RuleCardProps } from '#view/rulesBuilder/types.js';
	import PredicateBuilder from './PredicateBuilder.svelte';
	import SchemaFieldRenderer from './SchemaFieldRenderer.svelte';

	let { rule, manager, onMoveUp, onMoveDown, onDelete }: RuleCardProps = $props();

	const { ruleDataModels, ruleTypes } = CONFIG.NIMBLE;
	const RuleClass = $derived(ruleDataModels[rule.type as string]);
	const ruleLabel = $derived(
		(rule.label as string) || localize(ruleTypes[rule.type as string] ?? (rule.type as string)),
	);
	const schema = $derived.by(() => {
		if (!RuleClass) return null;
		try {
			return RuleClass.defineSchema() as Record<string, foundry.data.fields.DataField.Any>;
		} catch (err) {
			// eslint-disable-next-line no-console
			console.warn(`Nimble | RuleCard could not load schema for "${rule.type}"`, err);
			return null;
		}
	});

	let showJson = $state(false);
	// Surface a non-default priority to the author by opening the disclosure
	// it lives in — otherwise it's hidden inside Advanced and easy to miss.
	let advancedOpen = $state(typeof rule.priority === 'number' && rule.priority !== 1);
	let jsonDraft = $state(JSON.stringify(rule, null, 2));
	let jsonError = $state<string | null>(null);

	// Re-sync jsonDraft when rule changes from outside (after persistence).
	let lastSerialized = $state(JSON.stringify(rule));
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
</script>

<article
	class="nimble-rule-card"
	class:nimble-rule-card--disabled={Boolean(rule.disabled)}
	data-reorder-id={rule.id}
	draggable="true"
>
	<header class="nimble-rule-card__header">
		<button
			class="nimble-button nimble-rule-card__handle"
			type="button"
			data-button-variant="icon"
			data-reorder-handle
			data-tooltip="Drag to reorder (display order only — see Priority for application order)"
			aria-label="Reorder handle"
		>
			<i class="fa-solid fa-grip-vertical"></i>
		</button>

		<input
			class="nimble-rule-card__label"
			type="text"
			value={rule.label as string}
			placeholder={ruleLabel}
			onchange={(e) => emitFieldChange('label', (e.target as HTMLInputElement).value)}
		/>

		<span class="nimble-rule-card__type">{ruleTypes[rule.type as string] ?? rule.type}</span>

		{#if RuleClass}
			{@const ruleInstance = manager && (rule.id as string) ? null : null}
			<i
				class="nimble-rule-card__help fa-solid fa-circle-question"
				data-tooltip={(RuleClass as unknown as { description?: string }).description ?? ''}
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
			{#if onMoveUp}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="icon"
					data-tooltip="Move up"
					aria-label="Move up"
					onclick={onMoveUp}
				>
					<i class="fa-solid fa-arrow-up"></i>
				</button>
			{/if}
			{#if onMoveDown}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="icon"
					data-tooltip="Move down"
					aria-label="Move down"
					onclick={onMoveDown}
				>
					<i class="fa-solid fa-arrow-down"></i>
				</button>
			{/if}
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

	<small class="nimble-rule-card__reorder-hint">
		Drag-reorder controls display order only. Application order is set by the
		<strong>Priority</strong> advanced control below.
	</small>

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
			Could not load this rule's schema. Use raw-JSON edit to repair.
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
					<div class="nimble-field-row">
						<span class="nimble-field-row__label">{fieldName}</span>
						<SchemaFieldRenderer
							{field}
							value={rule[fieldName]}
							parentData={rule}
							name={fieldName}
							onChange={(v) => emitFieldChange(fieldName, v)}
						/>
					</div>
				{/each}
			{/if}
		</div>

		<details class="nimble-rule-card__advanced" open={advancedOpen}>
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

				<label class="nimble-field-row">
					<span class="nimble-field-row__label">Priority</span>
					<input
						type="number"
						value={(rule.priority as number) ?? 1}
						onchange={(e) => {
							const num = parseInt((e.target as HTMLInputElement).value, 10);
							if (!Number.isNaN(num)) emitFieldChange('priority', num);
						}}
					/>
					<small class="nimble-field-hint">
						Application order during data prep. Independent of drag-reorder above.
					</small>
				</label>

				<div class="nimble-field-row">
					<span class="nimble-field-row__label">Predicate</span>
					<PredicateBuilder
						value={(rule.predicate as RawPredicate) ?? {}}
						onChange={(v) => emitFieldChange('predicate', v)}
					/>
				</div>
			</div>
		</details>
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

		&__header {
			display: flex;
			gap: 0.375rem;
			align-items: center;
		}

		&__handle {
			cursor: grab;
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

		&__reorder-hint {
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
			font-style: italic;
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
	}

	.nimble-field-hint {
		display: block;
		margin-top: 0.125rem;
		color: var(--color-text-dark-secondary);
		font-size: var(--nimble-xs-text);
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
