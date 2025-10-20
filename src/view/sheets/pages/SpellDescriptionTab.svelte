<script>
import { getContext } from 'svelte';

import Editor from '../components/Editor.svelte';
import SecondaryNavigation from '../../components/SecondaryNavigation.svelte';

const subNavigation = [
	{
		component: DescriptionTab,
		label: 'Base Effect',
		name: 'baseEffect',
	},
	{
		component: HigherLevelDescriptionTab,
		label: 'Higher Level Effect',
		name: 'higherLevelEffect',
	},
];

let item = getContext('document');
let currentTab = $state(subNavigation[0]);
</script>

{#snippet DescriptionTab()}
    {#key item.reactive.system.description.baseEffect}
        <div class="nimble-spell-description-content">
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Base Spell Effect
                </h3>
            </header>

            <Editor
                field="system.description.baseEffect"
                content={item.reactive.system.description.baseEffect}
                document={item}
            />
        </div>
    {/key}
{/snippet}

{#snippet HigherLevelDescriptionTab()}
    {#key item.reactive.system.description.higherLevelEffect}
        <div class="nimble-spell-description-content">
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Higher Level Effect
                </h3>
            </header>

            <Editor
                field="system.description.higherLevelEffect"
                content={item.reactive.system.description.higherLevelEffect}
                document={item}
            />
        </div>
    {/key}
{/snippet}

<SecondaryNavigation bind:currentTab {subNavigation} />

<section class="nimble-sheet__body nimble-sheet__body--item">
    {@render currentTab?.component?.()}
</section>

<style lang="scss">
    :global(.nimble-sheet__body--item) {
        height: 100%;
    }

    .nimble-spell-description-content {
        display: block;
        height: 100%;
		align-content: flex-start;
		grid-area: notes;

        :global(prose-mirror) {
            height: 100%;
        }

        :global(.editor-content) {
            height: 100%;
            overflow-y: auto;
			padding-bottom: 1rem !important;
        }
    }

    .nimble-section-header {
        margin-block-end: 0.375rem;
    }
</style>
