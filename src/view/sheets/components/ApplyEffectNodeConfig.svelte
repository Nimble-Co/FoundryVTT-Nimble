<script lang="ts">
	import type { ApplyEffectNodeConfigProps } from '#types/components/ApplyEffectNodeConfig.d.ts';
	import localize from '#utils/localize.ts';
	import { deleteEffectNode } from '#utils/treeManipulation/deleteEffectNode.ts';
	import { updateEffectNode } from '#utils/treeManipulation/updateEffectNode.ts';
	import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.ts';
	import TagGroup from '../../components/TagGroup.svelte';
	import {
		createItemEffectOptions,
		tempHealingOptions,
	} from './ApplyEffectNodeConfigState.svelte.ts';

	const WORDS = 'NIMBLE.activationEffects.applyEffectNode';
	const NEW_EFFECT = '__new';

	let { node, document, effects }: ApplyEffectNodeConfigProps = $props();

	const itemEffects = createItemEffectOptions(() => document);
	const recipients = [
		{ value: 'targets', label: localize(`${WORDS}.recipients.targets`) },
		{ value: 'self', label: localize(`${WORDS}.recipients.self`) },
	];
	const conditionName = $derived(
		node.condition ? (CONFIG.NIMBLE.conditions[node.condition] ?? node.condition) : null,
	);
	const tempHealing = $derived(tempHealingOptions(effects));

	async function chooseEffect(value: string) {
		if (value !== NEW_EFFECT) {
			await updateEffectNode(document, effects, node, 'effectId', value || null);
			return;
		}
		const [created] =
			((await document.createEmbeddedDocuments('ActiveEffect', [
				{ name: document.name, img: document.img, type: NIMBLE_EFFECT_TYPE, transfer: false },
			] as never)) as unknown as { id: string }[] | undefined) ?? [];
		if (created) await updateEffectNode(document, effects, node, 'effectId', created.id);
	}

	function openEffect() {
		const effect = node.effectId ? document.effects?.get(node.effectId) : null;
		effect?.sheet?.render(true);
	}
</script>

<li data-node-id={node.id}>
	<header>
		<h4 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.activationEffects.applyEffect')}
		</h4>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label={localize(`${WORDS}.delete`)}
			data-tooltip={localize(`${WORDS}.delete`)}
			type="button"
			onclick={() => deleteEffectNode(document, effects, node.id)}
		>
			<i class="fa-solid fa-trash"></i>
		</button>
	</header>

	<div
		class="nimble-effect-main-config nimble-effect-main-config--no-sub-config"
		style="--nimble-card-width: 320px;"
	>
		<div class="nimble-config-block nimble-card">
			{#if conditionName && !node.effectId}
				<p class="nimble-apply-effect-config__condition">
					{localize(`${WORDS}.condition`, { name: conditionName })}
				</p>
			{:else}
				<label class="nimble-field" data-field-variant="stacked">
					<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
						{localize(`${WORDS}.effect`)}
					</h5>
					<div class="nimble-apply-effect-config__effect">
						<select onchange={({ currentTarget }) => chooseEffect(currentTarget.value)}>
							<option value="" selected={!node.effectId}>{localize(`${WORDS}.noEffect`)}</option>
							{#each itemEffects.options as option (option.id)}
								<option value={option.id} selected={option.id === node.effectId}>
									{option.name}
								</option>
							{/each}
							<option value={NEW_EFFECT}>{localize(`${WORDS}.newEffect`)}</option>
						</select>

						<button
							class="nimble-button"
							data-button-variant="icon"
							type="button"
							aria-label={localize(`${WORDS}.edit`)}
							data-tooltip={localize(`${WORDS}.edit`)}
							disabled={!node.effectId}
							onclick={openEffect}
						>
							<i class="fa-solid fa-pen"></i>
						</button>
					</div>
				</label>
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
							updateEffectNode(
								document,
								effects,
								node,
								'tempHealingNodeId',
								currentTarget.value || null,
							)}
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
		</div>
	</div>
</li>

<style lang="scss">
	.nimble-apply-effect-config {
		&__effect {
			display: flex;
			align-items: center;
			gap: 0.25rem;

			select {
				flex: 1 1 auto;
				min-width: 0;
			}
		}

		&__condition {
			margin: 0;
		}
	}
</style>
