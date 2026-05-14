<script lang="ts">
	import type { RawPredicate } from '../../../etc/Predicate.js';
	import localize from '#utils/localize.js';
	import overrideTextAreaBehavior from '#utils/overrideTextAreaBehavior.js';
	import {
		createRuleCardState,
		FIXED_FIELDS,
	} from '#view/rulesBuilder/components/RuleCardState.svelte.js';
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

	const state = createRuleCardState(
		() => rule,
		() => manager,
	);

	state.setupJsonSyncEffect();
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
				aria-label={collapsed
					? localize('NIMBLE.rulesBuilder.expandRule')
					: localize('NIMBLE.rulesBuilder.collapseRule')}
				data-tooltip={collapsed
					? localize('NIMBLE.rulesBuilder.expand')
					: localize('NIMBLE.rulesBuilder.collapse')}
				onclick={onToggleCollapse}
			>
				<i class="fa-solid {collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
			</button>
		{/if}

		<input
			class="nimble-rule-card__label"
			type="text"
			value={rule.label as string}
			placeholder={state.ruleLabel}
			onchange={(e) => state.emitFieldChange('label', (e.target as HTMLInputElement).value)}
		/>

		<span class="nimble-rule-card__type">{state.ruleTypes[rule.type as string] ?? rule.type}</span>

		<label
			class="nimble-rule-card__priority"
			data-tooltip={localize('NIMBLE.rulesBuilder.priorityTooltip')}
		>
			<span class="nimble-rule-card__priority-label"
				>{localize('NIMBLE.rulesBuilder.priority')}</span
			>
			<input
				type="number"
				class="nimble-rule-card__priority-input"
				value={(rule.priority as number) ?? 1}
				onchange={(e) => {
					const num = parseInt((e.target as HTMLInputElement).value, 10);
					if (!Number.isNaN(num)) state.emitFieldChange('priority', num);
				}}
			/>
		</label>

		{#if state.RuleClass}
			<i
				class="nimble-rule-card__help fa-solid fa-circle-question"
				data-tooltip={localize(
					(state.RuleClass as unknown as { description?: string }).description ?? '',
				)}
				data-tooltip-direction="UP"
			></i>
		{:else}
			<i
				class="nimble-rule-card__help fa-solid fa-circle-exclamation"
				data-tooltip={localize('NIMBLE.rulesBuilder.unknownRuleType', {
					type: String(rule.type),
				})}
				data-tooltip-direction="UP"
				style="color: var(--color-level-error);"
			></i>
		{/if}

		<div class="nimble-rule-card__controls">
			<button
				type="button"
				class="nimble-button"
				data-button-variant="icon"
				data-tooltip={rule.disabled
					? localize('NIMBLE.rulesBuilder.enableRule')
					: localize('NIMBLE.rulesBuilder.disableRule')}
				aria-label={rule.disabled
					? localize('NIMBLE.rulesBuilder.enableRule')
					: localize('NIMBLE.rulesBuilder.disableRule')}
				onclick={state.toggleDisabled}
			>
				<i class="fa-solid {rule.disabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
			</button>

			<button
				type="button"
				class="nimble-button"
				data-button-variant="icon"
				data-tooltip={state.showJson
					? localize('NIMBLE.rulesBuilder.switchToBuilder')
					: localize('NIMBLE.rulesBuilder.editRawJson')}
				aria-label={state.showJson
					? localize('NIMBLE.rulesBuilder.switchToBuilder')
					: localize('NIMBLE.rulesBuilder.editRawJson')}
				onclick={state.toggleJson}
			>
				<i class="fa-solid {state.showJson ? 'fa-list' : 'fa-code'}"></i>
			</button>

			{#if onDelete}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="icon"
					data-tooltip={localize('NIMBLE.rulesBuilder.deleteRule')}
					aria-label={localize('NIMBLE.rulesBuilder.deleteRule')}
					onclick={onDelete}
				>
					<i class="fa-solid fa-trash"></i>
				</button>
			{/if}
		</div>
	</header>

	{#if !collapsed}
		{#if state.showJson}
			<div class="nimble-rule-card__json">
				<textarea
					class="nimble-code-block__text-area"
					value={state.jsonDraft}
					oninput={(e) => state.setJsonDraft((e.target as HTMLTextAreaElement).value)}
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
						onclick={state.commitJson}
					>
						<i class="fa-solid fa-save"></i>
						{localize('NIMBLE.rulesBuilder.saveJson')}
					</button>
					{#if state.jsonError}
						<span class="nimble-rule-card__json-error">{state.jsonError}</span>
					{/if}
				</div>
			</div>
		{:else if !state.schema}
			<p class="nimble-rule-card__empty">
				{localize('NIMBLE.rulesBuilder.errorSchemaLoadBefore')}
				<code>{rule.type}</code>
				{localize('NIMBLE.rulesBuilder.errorSchemaLoadAfter')}
			</p>
		{:else}
			{@const editableEntries = Object.entries(state.schema).filter(
				([fieldName]) => !FIXED_FIELDS.has(fieldName),
			)}
			<div class="nimble-rule-card__body">
				{#if editableEntries.length === 0}
					<p class="nimble-rule-card__empty">
						{localize('NIMBLE.rulesBuilder.noFurtherConfig')}
					</p>
				{:else}
					{#each editableEntries as [fieldName, field] (fieldName)}
						{@const hint = state.fieldHint(field)}
						<div class="nimble-field-row">
							<span class="nimble-field-row__label">{state.fieldLabel(fieldName, field)}</span>
							<SchemaFieldRenderer
								{field}
								value={rule[fieldName]}
								parentData={rule}
								name={fieldName}
								onChange={(v) => state.emitFieldChange(fieldName, v)}
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
					{localize('NIMBLE.rulesBuilder.advanced')}
				</summary>

				<div class="nimble-rule-card__advanced-body">
					<div class="nimble-field-row">
						<span class="nimble-field-row__label"
							>{localize('NIMBLE.rulesBuilder.appliesWhen')}</span
						>
						<PredicateBuilder
							value={(rule.predicate as RawPredicate) ?? {}}
							onChange={(v) => state.emitFieldChange('predicate', v)}
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
