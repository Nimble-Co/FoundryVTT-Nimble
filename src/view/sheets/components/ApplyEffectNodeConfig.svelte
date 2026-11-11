<script lang="ts">
	import type { ApplyEffectNodeConfigProps } from '#types/components/ApplyEffectNodeConfig.d.ts';
	import localize from '#utils/localize.ts';
	import { updateEffectNode } from '#utils/treeManipulation/updateEffectNode.ts';
	import ItemEffectSelect from '../../components/ItemEffectSelect.svelte';
	import TagGroup from '../../components/TagGroup.svelte';
	import { tempHealingOptions } from './applyEffectNodeOptions.ts';

	const WORDS = 'NIMBLE.activationEffects.applyEffectNode';

	let { node, document, effects }: ApplyEffectNodeConfigProps = $props();

	const recipients = [
		{ value: 'targets', label: localize(`${WORDS}.recipients.targets`) },
		{ value: 'self', label: localize(`${WORDS}.recipients.self`) },
	];
	const conditionName = $derived(
		node.condition ? (CONFIG.NIMBLE.conditions[node.condition] ?? node.condition) : null,
	);
	const tempHealing = $derived(tempHealingOptions(effects));

	function storeEffect(effectId: string | null) {
		return updateEffectNode(document, effects, node, 'effectId', effectId);
	}
</script>

{#if conditionName && !node.effectId}
	<p class="nimble-apply-effect-config__condition">
		{localize(`${WORDS}.condition`, { name: conditionName })}
	</p>
{:else}
	<div class="nimble-field" data-field-variant="stacked">
		<h5
			class="nimble-field__label nimble-heading"
			data-heading-variant="field"
			id={`${node.id}-effect-label`}
		>
			{localize(`${WORDS}.effect`)}
		</h5>
		<ItemEffectSelect
			item={document as never}
			value={node.effectId}
			onchange={storeEffect}
			recipient={node.recipient}
			labelledby={`${node.id}-effect-label`}
		/>
	</div>
{/if}

<div style="width: 100%;">
	<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
		{localize(`${WORDS}.recipient`)}
	</h5>
	<TagGroup
		options={recipients}
		selectedOptions={[node.recipient]}
		toggleOption={(value) => updateEffectNode(document, effects, node, 'recipient', value)}
	/>
</div>

{#if tempHealing.length}
	<label class="nimble-field" data-field-variant="stacked">
		<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
			{localize(`${WORDS}.tempHealing`)}
		</h5>
		<select
			onchange={({ currentTarget }) =>
				updateEffectNode(document, effects, node, 'tempHealingNodeId', currentTarget.value || null)}
		>
			<option value="" selected={!node.tempHealingNodeId}>
				{localize(`${WORDS}.noTempHealing`)}
			</option>
			{#each tempHealing as option (option.id)}
				<option value={option.id} selected={option.id === node.tempHealingNodeId}>
					{localize(`${WORDS}.tempHealingFormula`, { formula: option.formula })}
				</option>
			{/each}
		</select>
	</label>
{/if}

<style lang="scss">
	.nimble-apply-effect-config {
		&__condition {
			margin: 0;
		}
	}
</style>
