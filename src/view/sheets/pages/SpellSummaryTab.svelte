<script>
	import { getContext } from 'svelte';

	let item = getContext('document');

	let baseEffectDescription = $derived(item.reactive.system.description.baseEffect);

	let higherLevelEffectDescription = $derived(item.reactive.system.description.higherLevelEffect);

	let isUtilitySpell = $derived(item.reactive.system.utility);
	let spellTier = $derived(item.reactive.system.tier);
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
    <section class="nimble-spell-description-content">
        <header class="nimble-section-header">
            <h3 class="nimble-heading" data-heading-variant="section">
                Base Spell Effect
            </h3>
        </header>

        {#await foundry.applications.ux.TextEditor.implementation.enrichHTML(baseEffectDescription) then baseEffect}
            <div class="nimble-summary__description">
                {@html baseEffect || "No description available"}
            </div>
        {/await}
    </section>

    {#await foundry.applications.ux.TextEditor.implementation.enrichHTML(higherLevelEffectDescription) then higherLevelEffect}
        {#if higherLevelEffect}
            <section class="nimble-spell-description-content">
                <header class="nimble-section-header">
                    <h4 class="nimble-heading" data-heading-variant="section">
                        {#if isUtilitySpell || spellTier === 0}
                            Higher Level Description
                        {:else}
                            Upcast
                        {/if}
                    </h4>
                </header>

                <div class="nimble-summary__description">
                    {@html higherLevelEffect}
                </div>
            </section>
        {/if}
    {/await}
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
