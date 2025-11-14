<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';

	let { characterSavingThrows } = $props();

	const { savingThrows, savingThrowAbbreviations } = CONFIG.NIMBLE;
	const actor = getContext('actor');
</script>

{#snippet savingThrowSnippet(saveKey, save)}
	{@const saveName = savingThrows[saveKey]}
	{@const saveAbbreviation = savingThrowAbbreviations[saveKey]}
	{@const tooltip = localize('NIMBLE.prompts.rollSavingThrowSpecific', {
		save: saveName,
	})}
	{@const rollModeClassModifier = save.defaultRollMode > 0 ? 'advantage' : 'disadvantage'}
	{@const rollModeIcon = save.defaultRollMode > 0 ? 'fa-circle-plus' : 'fa-circle-minus'}

	<button
		class="nimble-ability-score"
		type="button"
		aria-label={tooltip}
		data-tooltip={tooltip}
		onclick={() => actor.rollSavingThrowToChat(saveKey)}
	>
		<dt class="nimble-heading" data-heading-variant="section">
			{saveAbbreviation}
		</dt>

		<dd class="nimble-ability-score__value">
			{#if save.defaultRollMode === 0}
				<i class="nimble-saving-throw__roll-mode-icon fa-solid fa-circle"></i>
			{:else}
				{#each { length: Math.abs(save.defaultRollMode) }}
					<i
						class="nimble-saving-throw__roll-mode-icon nimble-saving-throw__roll-mode-icon--{rollModeClassModifier} fa-solid {rollModeIcon}"
					></i>
				{/each}
			{/if}
		</dd>
	</button>
{/snippet}

<section class="nimble-saving-throws-wrapper" style="grid-area: savingThrows;">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">Saving Throws</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			type="button"
			data-tooltip="NIMBLE.prompts.configureSkills"
			aria-label={localize('NIMBLE.prompts.configureSkills')}
			onclick={() => actor.configureSavingThrows()}
		>
			<i class="fa-solid fa-edit"></i>
		</button>
	</header>

	<dl class="nimble-stats">
		{#each Object.entries(characterSavingThrows) as [saveKey, savingThrow]}
			{@render savingThrowSnippet(saveKey, savingThrow)}
		{/each}
	</dl>
</section>

<style lang="scss">
	.nimble-saving-throw {
		&__roll-mode-icon {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			&--advantage {
				color: hsl(139, 48%, 36%);
			}

			&--disadvantage {
				color: var(--nimble-roll-failure-color);
			}
		}
	}
</style>
