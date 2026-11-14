<script lang="ts">
	import type { ScalingRaiseEffectRuleProps } from '#types/components/ScalingRaiseEffectRule.d.ts';
	import localize from '#utils/localize.js';

	let { delta, targets, onUpdate }: ScalingRaiseEffectRuleProps = $props();

	const t = (key: string) => localize(`NIMBLE.spellConfig.scaling.${key}`);

	const raiseTarget = $derived(
		targets.find((option) => option.nodeId === delta.targetEffectId) ?? null,
	);
	const raiseRule = $derived(raiseTarget?.rules.find((rule) => rule.id === delta.ruleId) ?? null);
	const raiseField = $derived(
		raiseRule?.fields.find((field) => field.name === delta.ruleField) ?? null,
	);
</script>

{#if targets.length === 0}
	<p class="nimble-scaling-empty">{t('noEffectRules')}</p>
{:else}
	<label class="nimble-field" data-field-variant="stacked">
		<span class="nimble-heading" data-heading-variant="field">{t('targetEffect')}</span>
		<select
			value={raiseTarget?.nodeId ?? ''}
			onchange={(event) => onUpdate('targetEffectId', event.currentTarget.value || null)}
		>
			{#if !raiseTarget}
				<option value="">{t('chooseOne')}</option>
			{/if}
			{#each targets as option (option.nodeId)}
				<option value={option.nodeId}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label class="nimble-field" data-field-variant="stacked">
		<span class="nimble-heading" data-heading-variant="field">{t('effectRule')}</span>
		<select
			value={raiseRule?.id ?? ''}
			disabled={!raiseTarget?.rules.length}
			onchange={(event) => onUpdate('ruleId', event.currentTarget.value || null)}
		>
			<option value="">{t('chooseOne')}</option>
			{#each raiseTarget?.rules ?? [] as rule (rule.id)}
				<option value={rule.id}>{rule.label}</option>
			{/each}
		</select>
	</label>
	<label class="nimble-field" data-field-variant="stacked">
		<span class="nimble-heading" data-heading-variant="field">{t('ruleField')}</span>
		<select
			value={delta.ruleField ?? ''}
			disabled={!raiseRule?.fields.length}
			onchange={(event) => onUpdate('ruleField', event.currentTarget.value || null)}
		>
			<option value="">{t('chooseOne')}</option>
			{#each raiseRule?.fields ?? [] as numberField (numberField.name)}
				<option value={numberField.name}>{numberField.label}</option>
			{/each}
		</select>
	</label>
	{#if raiseField?.kind === 'formula'}
		<label class="nimble-field" data-field-variant="stacked">
			<span class="nimble-heading" data-heading-variant="field">{t('formula')}</span>
			<input
				type="text"
				value={delta.formula ?? ''}
				placeholder="@key"
				onchange={(event) => onUpdate('formula', event.currentTarget.value.trim() || null)}
			/>
		</label>
	{:else}
		<label class="nimble-field" data-field-variant="stacked">
			<span class="nimble-heading" data-heading-variant="field">{t('value')}</span>
			<input
				type="number"
				value={delta.value ?? 0}
				onchange={(event) => onUpdate('value', Number(event.currentTarget.value))}
			/>
		</label>
	{/if}
{/if}

<style lang="scss">
	.nimble-field {
		flex: 1;
		min-width: 0;
	}

	select,
	input {
		width: 100%;
	}

	.nimble-scaling-empty {
		font-size: var(--nimble-sm-text);
		color: var(--nimble-text-color-secondary);
		font-style: italic;
		margin: 0;
	}
</style>
