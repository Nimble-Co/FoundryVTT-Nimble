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
	import RuleFormLayout from './RuleFormLayout.svelte';
	import SchemaFieldRenderer from './SchemaFieldRenderer.svelte';

	let {
		rule,
		manager,
		previewDomain,
		onDelete,
		collapsed = false,
		onToggleCollapse,
		document,
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
			data-look="plain"
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
				data-look="plain"
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

	{#if state.failure}
		<p class="nimble-rule-card__failure" role="alert">
			<i class="fa-solid fa-triangle-exclamation"></i>
			<span>
				{localize('NIMBLE.rulesBuilder.ruleNotRunning')}
				{state.failure}
			</span>
		</p>
	{/if}

	{#if !collapsed}
		{#if state.showJson}
			<div class="nimble-rule-card__json">
				<textarea
					class="nimble-rule-card__json-textarea"
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
				{#if state.formGroups}
					<RuleFormLayout
						groups={state.formGroups}
						{rule}
						onFieldChange={state.emitFieldChange}
						fieldLabel={state.fieldLabel}
						fieldHint={state.fieldHint}
						{previewDomain}
						appliesInPrePrepareData={state.appliesInPrePrepareData}
						{document}
					/>
				{:else if editableEntries.length === 0}
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
								{document}
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
					{#if !state.predicateInForm}
						<div class="nimble-field-row">
							<span class="nimble-field-row__label"
								>{localize('NIMBLE.rulesBuilder.appliesWhen')}</span
							>
							<PredicateBuilder
								value={(rule.predicate as RawPredicate) ?? {}}
								onChange={(v) => state.emitFieldChange('predicate', v)}
								{previewDomain}
								appliesInPrePrepareData={state.appliesInPrePrepareData}
							/>
						</div>
					{/if}

					<div class="nimble-field-row">
						<span class="nimble-field-row__label"
							>{localize('NIMBLE.rulesBuilder.suppressActivationCard')}</span
						>
						<select
							value={(rule.suppressActivationCard as string) ?? 'auto'}
							onchange={(e) =>
								state.emitFieldChange(
									'suppressActivationCard',
									(e.target as HTMLSelectElement).value,
								)}
						>
							<option value="auto">
								{localize('NIMBLE.rulesBuilder.suppressActivationCardAuto')}
							</option>
							<option value="always">
								{localize('NIMBLE.rulesBuilder.suppressActivationCardAlways')}
							</option>
							<option value="never">
								{localize('NIMBLE.rulesBuilder.suppressActivationCardNever')}
							</option>
						</select>
						<small class="nimble-field-row__hint"
							>{localize('NIMBLE.rulesBuilder.suppressActivationCardHint')}</small
						>
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
		gap: 10px;
		padding: 8px 12px 12px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		color: var(--nimble-ui-ink);

		&--disabled {
			opacity: 0.6;
		}

		&--collapsed {
			gap: 0;
		}

		// The name keeps room to read; the badges and controls go to a second line when there is not enough.
		&__header {
			display: flex;
			flex-wrap: wrap;
			gap: 4px 8px;
			align-items: center;
		}

		&__chevron {
			color: var(--nimble-ui-ink-dim);
			flex-shrink: 0;
		}

		&__priority {
			display: inline-flex;
			gap: 0.25rem;
			align-items: center;
			font-size: 0.688rem;
			color: var(--nimble-ui-ink-dim);
		}

		&__priority-label {
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.nimble-rule-card__priority-input {
			width: 2.5rem;
			height: 26px;
			padding: 0 3px;
			border: 0;
			border-bottom: 1px dashed var(--nimble-ui-ring);
			border-radius: 0;
			background: none;
			font-size: 0.875rem;
			font-weight: 700;
			text-align: right;
			color: var(--nimble-ui-ink);

			&:focus {
				border-bottom: 1px solid var(--nimble-ui-highlight);
				outline: none;
			}
		}

		.nimble-rule-card__label {
			flex: 1 1 9rem;
			min-width: 0;
			text-overflow: ellipsis;
			height: 26px;
			padding: 0 2px;
			border: 0;
			border-bottom: 1px dashed transparent;
			border-radius: 0;
			background: none;
			font-size: 0.938rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);

			&:hover {
				border-bottom-color: var(--nimble-ui-ring);
			}

			&:focus {
				border-bottom: 1px solid var(--nimble-ui-highlight);
				outline: none;
			}
		}

		&__type {
			padding: 0 5px;
			border-radius: 3px;
			box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
			font: 800 0.656rem/16px var(--nimble-primary-font);
			letter-spacing: 0.05em;
			text-transform: uppercase;
			white-space: nowrap;
			color: var(--nimble-ui-ink-muted);
		}

		&__controls {
			display: flex;
			gap: 0.125rem;
			margin-inline-start: auto;
		}

		&__body {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__empty {
			margin: 0;
			padding: 0.5rem;
			color: var(--nimble-ui-ink-muted);
			font-size: 0.75rem;
			font-style: italic;
			text-align: center;
		}

		&__advanced {
			padding-top: 2px;

			summary {
				cursor: pointer;
				font-size: 0.813rem;
				font-weight: 700;
				color: var(--nimble-ui-ink-dim);
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

		&__json-textarea {
			padding: 0.5rem;
			font-family: var(--nimble-mono-font);
			font-size: var(--nimble-sm-text);
			color: var(--nimble-code-editor-text-color);
			background: var(--nimble-code-editor-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			resize: vertical;
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

		&__failure {
			display: flex;
			gap: 0.375rem;
			align-items: baseline;
			margin: 0;
			padding: 0.375rem 0.5rem;
			color: var(--color-level-error);
			font-size: var(--nimble-xs-text);
			border-left: 2px solid var(--color-level-error);
		}

		&__help {
			color: var(--nimble-ui-ink-muted);
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
			color: var(--nimble-ui-ink-muted);
		}

		&__hint {
			margin-top: 0.0625rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-ui-ink-muted);
			line-height: 1.3;
		}
	}
</style>
