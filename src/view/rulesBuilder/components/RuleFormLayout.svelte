<script lang="ts">
	import type { RawPredicate } from '../../../etc/Predicate.js';
	import localize from '#utils/localize.js';
	import type { RuleFormLayoutProps } from '#view/rulesBuilder/types.js';
	import PredicateBuilder from './PredicateBuilder.svelte';
	import SchemaFieldRenderer from './SchemaFieldRenderer.svelte';

	let {
		groups,
		rule,
		onFieldChange,
		fieldLabel,
		fieldHint,
		previewDomain,
		appliesInPrePrepareData = false,
		document,
	}: RuleFormLayoutProps = $props();
</script>

<div class="nimble-rule-form">
	{#each groups as group (group.key)}
		<section class="nimble-rule-form__group" data-group={group.key}>
			{#if group.label}
				<span class="nimble-rule-form__question">{localize(group.label)}</span>
			{:else if group.labelField}
				<span class="nimble-rule-form__question">
					{fieldLabel(group.labelField.name, group.labelField.field)}
				</span>
			{/if}

			{#each group.fields as { name, field, isBoolean, showLabel } (name)}
				{@const hint = fieldHint(field)}
				<div class="nimble-rule-form__field" data-field={name}>
					{#if name === 'predicate'}
						<PredicateBuilder
							value={(rule.predicate as RawPredicate) ?? {}}
							onChange={(v) => onFieldChange('predicate', v)}
							{previewDomain}
							{appliesInPrePrepareData}
						/>
					{:else if isBoolean}
						<label class="nimble-rule-form__check">
							<SchemaFieldRenderer
								{field}
								value={rule[name]}
								parentData={rule}
								{name}
								onChange={(v) => onFieldChange(name, v)}
								{document}
							/>
							<span class="nimble-rule-form__check-label">{fieldLabel(name, field)}</span>
						</label>
					{:else}
						{#if showLabel}
							<span class="nimble-rule-form__label">{fieldLabel(name, field)}</span>
						{/if}
						<SchemaFieldRenderer
							{field}
							value={rule[name]}
							parentData={rule}
							{name}
							onChange={(v) => onFieldChange(name, v)}
							{document}
						/>
					{/if}
					{#if hint}
						<small class="nimble-rule-form__hint">{hint}</small>
					{/if}
				</div>
			{/each}

			{#if group.hint}
				<small class="nimble-rule-form__hint">{localize(group.hint)}</small>
			{/if}
		</section>
	{/each}
</div>

<style lang="scss">
	.nimble-rule-form {
		display: flex;
		flex-direction: column;

		&__group {
			display: flex;
			flex-direction: column;
			gap: 10px;
			padding: 10px 0;
			border-top: 1px solid var(--nimble-ui-soft);

			&:first-child {
				padding-top: 0;
				border-top: 0;
			}
		}

		&__question {
			font-size: 0.688rem;
			font-weight: 900;
			letter-spacing: 0.1em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-dim);
		}

		&__field {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		&__label {
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);
		}

		&__check {
			display: flex;
			gap: 14px;
			align-items: center;
			justify-content: space-between;
			flex-direction: row-reverse;
			min-height: 30px;
			cursor: pointer;
		}

		&__check-label {
			font-size: 0.813rem;
			font-weight: 600;
		}

		&__hint {
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-muted);
			line-height: 1.3;
		}
	}
</style>
