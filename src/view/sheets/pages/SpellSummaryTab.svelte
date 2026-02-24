<script>
	import { getContext } from 'svelte';

	let item = getContext('document');

	let baseEffectDescription = $derived(item.reactive.system.description.baseEffect);

	let higherLevelEffectDescription = $derived(item.reactive.system.description.higherLevelEffect);

	let upcastEffectDescription = $derived(item.reactive.system.description.upcastEffect);

	let isUtilitySpell = $derived(item.reactive.system.utility);
	let spellTier = $derived(item.reactive.system.tier);
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	<section class="nimble-spell-description-content">
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Base Spell Effect</h3>
		</header>

		{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(baseEffectDescription) then baseEffect}
			<div class="nimble-summary__description">
				{@html baseEffect || 'No description available'}
			</div>
		{/await}
	</section>

	{#if higherLevelEffectDescription}
		{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(higherLevelEffectDescription) then higherLevelEffect}
			{#if higherLevelEffect}
				<section class="nimble-spell-description-content">
					<header class="nimble-section-header">
						<h4 class="nimble-heading" data-heading-variant="section">Higher Level Effect</h4>
					</header>

					<div class="nimble-summary__description">
						{@html higherLevelEffect}
					</div>
				</section>
			{/if}
		{/await}
	{/if}

	{#if spellTier > 0 && !isUtilitySpell && upcastEffectDescription}
		{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(upcastEffectDescription) then upcastContent}
			{#if upcastContent}
				<section class="nimble-spell-description-content">
					<header class="nimble-section-header">
						<h4 class="nimble-heading" data-heading-variant="section">Upcast</h4>
					</header>

					<div class="nimble-summary__description">
						{@html upcastContent}
					</div>
				</section>
			{/if}
		{/await}
	{/if}
</section>

<style lang="scss">
	:global(.nimble-sheet__body--item) {
		height: 100%;
	}

	.nimble-sheet__body {
		overflow: auto !important;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.nimble-spell-description-content {
		display: block;
		height: auto;
		align-content: flex-start;

		:global(prose-mirror) {
			height: 100%;
		}

		:global(.editor-content) {
			height: 100%;
			overflow-y: auto;
			padding-bottom: 1rem !important;
		}

		.nimble-summary__description {
			font-size: var(--nimble-sm-text);

			:global(*:first-child) {
				margin-block-start: 0;
			}
		}
	}
</style>
