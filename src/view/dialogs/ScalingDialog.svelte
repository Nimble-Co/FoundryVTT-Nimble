<script>
import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';
import { updateEffectNode } from '../../utils/treeManipulation/updateEffectNode.js';

import TagGroup from '../components/TagGroup.svelte';

function getNearestScalingFormulaForCharacterLevel(node, level) {
	if (level === 1) {
		return node.formula;
	}
}

function toggleTab(value) {
	currentTab = tabs.find((tab) => tab.value === value);
}

function updateScalingFormula(node, level, formula) {
	if (level === 1) {
		updateEffectNode(item, effects, node, 'formula', formula);
	} else {
		updateEffectNode(item, effects, node, `scaling.${level}.formula`, formula);
	}
}

const tabs = [
	{
		value: 'characterLevel',
		label: 'Scale by Level',
		component: CharacterLevelScaling,
	},
];

let { item, node } = $props();

if (item?.type === 'spell') {
	tabs.push({
		value: 'spellLevel',
		label: 'Scale by Spell Level',
		component: SpellLevelScaling,
	});
}

let effects = $derived(item.reactive.system.activation.effects);

let currentTab = $derived(tabs.find((tab) => tab.value === node?.scaling?.type) ?? tabs[0]);
</script>

{#snippet CharacterLevelScaling(item, node)}
    <header class="nimble-section-header">
        <h2 class="nimble-heading" data-heading-variant="section">
            Scaling by Character Level
        </h2>
    </header>

    <table>
        <thead>
            <tr>
                <th style="width: fit-content;"> Level </th>

                <th style="width: max-content"> Formula </th>
            </tr>
        </thead>

        <tbody>
            {#each { length: 20 }, index}
                {@const level = index + 1}

                <tr>
                    <td>Level {level}</td>

                    <td>
                        <input
                            type="text"
                            value={getNearestScalingFormulaForCharacterLevel(
                                node,
                                level,
                            )}
                            onchange={({ target }) =>
                                updateScalingFormula(node, level, target.value)}
                        />
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
{/snippet}

{#snippet SpellLevelScaling(item, node)}{/snippet}

<section class="nimble-sheet__body nimble-sheet__body--item">
    {#if tabs.length > 1}
        <TagGroup
            options={tabs}
            selectedOptions={[currentTab.value]}
            toggleOption={toggleTab}
        />
    {/if}

    {@render currentTab.component(item, node)}
</section>

<style>
    .nimble-sheet__body {
        --nimble-sheet-body-padding-block-start: 0.5rem;
    }

    header {
        margin-block-start: 0.5rem;
    }

    table {
        table-layout: auto !important;

        th:last-child,
        td:last-child {
            padding-inline: 0.25rem;
        }

        th {
            text-align: center;
        }
    }
</style>
