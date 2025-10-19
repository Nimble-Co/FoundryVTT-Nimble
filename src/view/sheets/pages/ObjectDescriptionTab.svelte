<script>
import { getContext } from 'svelte';

import Editor from '../components/Editor.svelte';
import SecondaryNavigation from '../../components/SecondaryNavigation.svelte';

const subNavigation = [
	{
		component: DescriptionTab,
		label: 'Base',
		name: 'baseDescription',
	},
	{
		component: UnidentifiedDescription,
		label: 'Unidentified',
		name: 'unidentifiedDescription',
	},
	{
		component: SecretDescriptionTab,
		label: 'Secret',
		name: 'secretDescription',
	},
];

let item = getContext('document');
let currentTab = $state(subNavigation[0]);
</script>

{#snippet DescriptionTab()}
    {#key item.reactive.system.description.public}
        <div class="nimble-description-tab-content">
            <header class="nimble-sheet-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Description
                </h3>
            </header>

            <Editor
                field="system.description.public"
                content={item.reactive.system.description.public}
                document={item}
            />
        </div>
    {/key}
{/snippet}

{#snippet SecretDescriptionTab()}
    {#key item.reactive.system.description.secret}
        <div class="nimble-description-tab-content">
            <header class="nimble-sheet-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Secret Notes
                </h3>
            </header>

            <Editor
                field="system.description.secret"
                content={item.reactive.system.description.secret}
                document={item}
            />
        </div>
    {/key}
{/snippet}

{#snippet UnidentifiedDescription()}
    {#key item.reactive.system.description.unidentified}
        <div class="nimble-description-tab-content">
            <header class="nimble-sheet-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Unidentified Description
                </h3>
            </header>

            <Editor
                field="system.description.unidentified"
                content={item.reactive.system.description.unidentified}
                document={item}
            />
        </div>
    {/key}
{/snippet}

<SecondaryNavigation bind:currentTab {subNavigation} />

<section class="nimble-sheet__body">
    {@render currentTab?.component?.()}
</section>

<style lang="scss">
    :global(.nimble-sheet__body) {
        height: 100%;
    }

    .nimble-description-tab-content {
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
			padding-bottom: 15px !important;
        }
    }

    .nimble-sheet-section-header {
        margin-block-end: 0.375rem;
    }
</style>
