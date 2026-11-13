<script lang="ts">
	import type { ScalingLengthenLastsUntilProps } from '#types/components/ScalingLengthenLastsUntil.d.ts';
	import localize from '#utils/localize.js';

	let { delta, targets, onUpdate }: ScalingLengthenLastsUntilProps = $props();

	const t = (key: string) => localize(`NIMBLE.spellConfig.scaling.${key}`);

	const lengthenTarget = $derived(
		targets.find((option) => option.nodeId === delta.targetEffectId) ?? null,
	);
	const moment = $derived(
		lengthenTarget?.moments.find((entry) => entry.index === delta.momentIndex) ?? null,
	);
</script>

{#if targets.length === 0}
	<p class="nimble-scaling-empty">{t('noEffectMoments')}</p>
{:else}
	<label class="nimble-field" data-field-variant="stacked">
		<span class="nimble-heading" data-heading-variant="field">{t('targetEffect')}</span>
		<select
			value={lengthenTarget?.nodeId ?? ''}
			onchange={(event) => onUpdate('targetEffectId', event.currentTarget.value || null)}
		>
			{#if !lengthenTarget}
				<option value="">{t('chooseOne')}</option>
			{/if}
			{#each targets as option (option.nodeId)}
				<option value={option.nodeId}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label class="nimble-field" data-field-variant="stacked">
		<span class="nimble-heading" data-heading-variant="field">{t('moment')}</span>
		<select
			value={moment ? String(moment.index) : ''}
			disabled={!lengthenTarget}
			onchange={(event) =>
				onUpdate(
					'momentIndex',
					event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
				)}
		>
			<option value="">{t('chooseOne')}</option>
			{#each lengthenTarget?.moments ?? [] as entry (entry.index)}
				<option value={String(entry.index)}>{entry.label}</option>
			{/each}
		</select>
	</label>
	<label class="nimble-field" data-field-variant="stacked">
		<span class="nimble-heading" data-heading-variant="field">{t('value')}</span>
		<input
			type="number"
			min="1"
			value={delta.value ?? 1}
			onchange={(event) => onUpdate('value', Math.max(1, Number(event.currentTarget.value) || 1))}
		/>
	</label>
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
