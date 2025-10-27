<script>
import { getContext } from 'svelte';
import { createEffectNode } from '../../../utils/treeManipulation/createEffectNode.js';
import { deleteEffectNode } from '../../../utils/treeManipulation/deleteEffectNode.js';
import { updateEffectNode } from '../../../utils/treeManipulation/updateEffectNode.js';

import GenericDialog from '../../../documents/dialogs/GenericDialog.svelte.js';

import ScalingDialog from '../../dialogs/ScalingDialog.svelte';
import TagGroup from '../../components/TagGroup.svelte';

function getNodeOptions(node) {
	// Define available options for different node types
	const nodeOptions = new Map([
		['condition', 'Condition'],
		['damage', 'Damage'],
		['damageOutcome', 'Damage Outcome'],
		['healing', 'Healing'],
		['note', 'Note'],
		['savingThrow', 'Saving Throw'],
	]);

	const includedOptions = [];

	// Determine included options based on the node type
	if (node === null) {
		includedOptions.push('damage', 'healing', 'condition', 'savingThrow');
	} else if (node.type === 'damage') {
		includedOptions.push('damage', 'damageOutcome', 'healing', 'condition', 'savingThrow', 'note');
	} else if (node.type === 'savingThrow') {
		includedOptions.push('damage', 'healing', 'condition', 'note');
	}

	return includedOptions.sort().map((option) => ({
		value: option,
		label: nodeOptions.get(option),
	}));
}

function getNodeSnippet(nodeType) {
	switch (nodeType) {
		case 'condition':
			return ConditionNode;
		case 'damage':
			return DamageNode;
		case 'damageOutcome':
			return DamageOutcomeNode;
		case 'healing':
			return HealingNode;
		case 'savingThrow':
			return SaveNode;
		case 'note':
			return TextNode;
	}

	return null;
}

function getValidActionConsequences(node) {
	if (node.type === 'damage') {
		if (node.parentContext === 'sharedRolls') {
			return [
				['failedSave', 'On Failed Save'],
				['passedSave', 'On Passed Save'],
			];
		}

		return [
			['criticalHit', 'On Critical Hit'],
			['hit', 'On Hit'],
			['miss', 'On Miss'],
		];
	}

	if (node.type === 'savingThrow') {
		return [
			['failedSave', 'On Failed Save'],
			['passedSave', 'On Passed Save'],
		];
	}

	return [];
}

function openScalingDialog(item, node) {
	const dialog = new GenericDialog(`${item.name}: Roll Scaling Dialog`, ScalingDialog, {
		item,
		node,
	});

	dialog.render(true);
}

function prepareSavingThrowOptions(savingThrows) {
	return Object.entries(savingThrows).map(([key, value]) => ({
		label: value,
		value: key,
	}));
}

function toggleEffectCreationOptions() {
	const creationButtons = this.closest('header').nextElementSibling;
	creationButtons.style.display = 'block';
}

const { conditions, damageTypes, healingTypes, savingThrows } = CONFIG.NIMBLE;

const damageOutcomes = [
	{ value: 'fullDamage', label: 'Full Damage' },
	{ value: 'halfDamage', label: 'Half Damage' },
];

const noteTypes = [
	{ value: 'general', label: 'General' },
	{ value: 'flavor', label: 'Flavor' },
	{ value: 'reminder', label: 'Reminder' },
	{ value: 'warning', label: 'Warning' },
];

let document = getContext('document');

let effects = $derived(document.reactive.system.activation.effects);
let savingThrowOptions = prepareSavingThrowOptions(savingThrows);
</script>

<section>
    <header class="nimble-section-header">
        <h3 class="nimble-heading" data-heading-variant="section">Effects</h3>

        <button
            class="nimble-button"
            data-button-variant="icon"
            aria-label="Add Effect"
            data-tooltip="Add Effect"
            onclick={toggleEffectCreationOptions}
        >
            <i class="fa-solid fa-square-plus"></i>
        </button>
    </header>

    {@render EffectCreationButtons(null, null)}

    <section class="nimble-effect-tree">
        <ul>
            {#each effects as node}
                {@render getNodeSnippet(node?.type)?.(node)}
            {/each}
        </ul>
    </section>
</section>

{#snippet EffectCreationButtons(node, context, sharedRoll = null)}
    <div style="display: none; margin-bottom: 0.25rem;">
        <TagGroup
            options={getNodeOptions(node, context)}
            toggleOption={(nodeType, event) =>
                createEffectNode(
                    document,
                    effects,
                    nodeType,
                    event,
                    context,
                    sharedRoll,
                )}
        />
    </div>
{/snippet}

{#snippet DamageNode(node, parentNode = null)}
    {#snippet MainConfig(node, parentNode = null)}
        <div
            class="nimble-effect-main-config"
            class:nimble-effect-main-config--roll={node.type === "damage" ||
                node.type === "healing"}
            class:nimble-effect-main-config--no-sub-config={parentNode &&
                node.parentContext !== "sharedRolls"}
        >
            <div class="nimble-config-block nimble-card">
                <!-- Check the damage node id against the first damage node id in the effects list -->
                {#if node.id === effects.find((effect) => effect.type === "damage")?.id}
                    <label class="nimble-field">
                        <input
                            type="checkbox"
                            checked={node.canMiss}
                            onchange={({ target }) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "canMiss",
                                    target.checked,
                                )}
                        />

                        <h5
                            class="nimble-field__label nimble-heading"
                            data-heading-variant="field"
                        >
                            Can Miss
                        </h5>
                    </label>

                    <label class="nimble-field">
                        <input
                            type="checkbox"
                            checked={node.canCrit}
                            onchange={({ target }) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "canCrit",
                                    target.checked,
                                )}
                        />

                        <h5
                            class="nimble-field__label nimble-heading"
                            data-heading-variant="field"
                        >
                            Can Crit
                        </h5>
                    </label>
                {/if}

                <label class="nimble-field">
                    <input
                        type="checkbox"
                        checked={node.ignoreArmor}
                        onchange={({ target }) =>
                            updateEffectNode(
                                document,
                                effects,
                                node,
                                "ignoreArmor",
                                target.checked,
                            )}
                    />

                    <h5
                        class="nimble-field__label nimble-heading"
                        data-heading-variant="field"
                    >
                        Ignore Armor
                    </h5>
                </label>

                <label class="nimble-field">
                    <input
                        type="checkbox"
                        checked={node.ignoreAllies}
                        onchange={({ target }) =>
                            updateEffectNode(
                                document,
                                effects,
                                node,
                                "ignoreAllies",
                                target.checked,
                            )}
                    />

                    <h5
                        class="nimble-field__label nimble-heading"
                        data-heading-variant="field"
                    >
                        Only Damage Hostile Actors
                    </h5>
                </label>

                <div style="display: flex; gap: 0.5rem; width: 100%;">
                    <label style="width: 100%; flex-grow: 1;">
                        <header class="nimble-header">
                            <h5
                                class="nimble-field__label nimble-heading"
                                data-heading-variant="field"
                            >
                                Roll Formula
                            </h5>
                        </header>

                        <input
                            type="text"
                            value={node.formula}
                            onchange={({ target }) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "formula",
                                    target.value,
                                )}
                        />
                    </label>

                    <!-- <button
                        class="nimble-button"
                        data-button-variant="basic"
                        data-tooltip="Configure Damage Scaling"
                        aria-label="Configure Damage Scaling"
                        type="button"
                        onclick={() => openScalingDialog(document, node)}
                    >
                        <i
                            class="nimble-button__icon fa-solid fa-arrow-up-right-dots"
                        ></i>
                    </button> -->

                    <label>
                        <header
                            class="nimble-header"
                            style="padding-inline-end: 0.5rem;"
                        >
                            <h5
                                class="nimble-field__label nimble-heading"
                                data-heading-variant="field"
                            >
                                Damage Type
                            </h5>
                        </header>

                        <select
                            onchange={({ target }) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "damageType",
                                    target.value,
                                )}
                        >
                            {#each Object.entries(damageTypes) as [value, label]}
                                <option
                                    {value}
                                    selected={value === node.damageType}
                                    >{label}</option
                                >
                            {/each}
                        </select>
                    </label>
                </div>
            </div>
        </div>
    {/snippet}

    <li data-node-id={node.id}>
        {#if !parentNode || node.parentContext === "sharedRolls"}
            <details open>
                <summary class="nimble-tree-node-summary">
                    <h4 class="nimble-heading" data-heading-variant="field">
                        Damage
                    </h4>

                    <button
                        class="nimble-button"
                        data-button-variant="icon"
                        aria-label="Delete damage roll"
                        data-tooltip="Delete damage roll"
                        type="button"
                        onclick={() =>
                            deleteEffectNode(document, effects, node.id)}
                    >
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </summary>

                {@render MainConfig(node, parentNode)}

                <ul>
                    {#each getValidActionConsequences(node) as [key, label]}
                        <li>
                            <header>
                                <h4
                                    class="nimble-heading"
                                    data-heading-variant="field"
                                >
                                    {label}
                                </h4>

                                {#if node.parentContext === "sharedRolls"}
                                    <button
                                        class="nimble-button"
                                        data-button-variant="icon"
                                        aria-label="Add shared damage roll"
                                        data-tooltip="Add shared damage roll"
                                        type="button"
                                        onclick={(event) =>
                                            createEffectNode(
                                                document,
                                                effects,
                                                "damageOutcome",
                                                event,
                                                key,
                                            )}
                                    >
                                            <i class="fa-solid fa-square-plus"></i>
                                    </button>
                                {:else}
                                    <button
                                        class="nimble-button"
                                        data-button-variant="icon"
                                        aria-label="Add cbild node"
                                        data-tooltip="Add child node"
                                        type="button"
                                        onclick={toggleEffectCreationOptions}
                                    >
                                            <i class="fa-solid fa-square-plus"></i>
                                    </button>
                                {/if}
                            </header>

                            {@render EffectCreationButtons(node, key)}

                            {#if node?.on?.[key]?.length}
                                <ul>
                                    {#each node.on[key] as childNode}
                                        {@render getNodeSnippet(
                                            childNode?.type,
                                        )(childNode, node)}
                                    {/each}
                                </ul>
                            {:else}
                                <span>No additional effects</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </details>
        {:else}
            <header>
                <h4 class="nimble-heading" data-heading-variant="field">
                    Damage
                </h4>

                <button
                    class="nimble-button"
                    data-button-variant="icon"
                    aria-label="Delete damage roll"
                    data-tooltip="Delete damage roll"
                    type="button"
                    onclick={() => deleteEffectNode(document, effects, node.id)}
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            </header>

            {@render MainConfig(node, parentNode)}
        {/if}
    </li>
{/snippet}

{#snippet HealingNode(node, parentNode = null)}
    <li data-node-id={node.id}>
        <header>
            <h4 class="nimble-heading" data-heading-variant="field">Healing</h4>

            <button
                class="nimble-button"
                data-button-variant="icon"
                aria-label="Delete damage roll"
                data-tooltip="Delete damage roll"
                type="button"
                onclick={() => deleteEffectNode(document, effects, node.id)}
            >
                <i class="fa-solid fa-trash"></i>
            </button>
        </header>

        <div
            class="nimble-effect-main-config nimble-effect-main-config--no-sub-config"
        >
            <div class="nimble-config-block nimble-card">
                <div style="display: flex; gap: 0.5rem; width: 100%;">
                    <label style="width: 100%; flex-grow: 1;">
                        <header class="nimble-header">
                            <h5
                                class="nimble-field__label nimble-heading"
                                data-heading-variant="field"
                            >
                                Roll Formula
                            </h5>
                        </header>

                        <input
                            type="text"
                            value={node.formula}
                            onchange={({ target }) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "formula",
                                    target.value,
                                )}
                        />
                    </label>

                    <!-- <button
                        class="nimble-button"
                        data-button-variant="basic"
                        data-tooltip="Configure Damage Scaling"
                        aria-label="Configure Damage Scaling"
                        type="button"
                    >
                        <i
                            class="nimble-button__icon fa-solid fa-arrow-up-right-dots"
                        ></i>
                    </button> -->

                    <label>
                        <header
                            class="nimble-header"
                            style="padding-inline-end: 0.5rem;"
                        >
                            <h5
                                class="nimble-field__label nimble-heading"
                                data-heading-variant="field"
                            >
                                Healing Type
                            </h5>
                        </header>

                        <select
                            onchange={({ target }) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "healingType",
                                    target.value,
                                )}
                        >
                            {#each Object.entries(healingTypes) as [value, label]}
                                <option
                                    {value}
                                    selected={value === node.healingType}
                                    >{label}</option
                                >
                            {/each}
                        </select>
                    </label>
                </div>
            </div>
        </div>
    </li>
{/snippet}

{#snippet SaveNode(node, parentNode = null)}
    <li data-node-id={node.id}>
        <details open>
            <summary class="nimble-tree-node-summary">
                <h4 class="nimble-heading" data-heading-variant="field">
                    Saving Throw
                </h4>

                <button
                    class="nimble-button"
                    data-button-variant="icon"
                    aria-label="Delete saving throw prompt"
                    data-tooltip="Delete saving throw prompt"
                    type="button"
                    onclick={() => deleteEffectNode(document, effects, node.id)}
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            </summary>

            <div class="nimble-effect-main-config">
                <div class="nimble-config-block nimble-card">
                    <div style="width: 100%; flex-grow: 1;">
                        <header class="nimble-header">
                            <h5
                                class="nimble-field__label nimble-heading"
                                data-heading-variant="field"
                            >
                                Save Type
                            </h5>
                        </header>

                        <TagGroup
                            options={savingThrowOptions}
                            selectedOptions={[node.saveType]}
                            toggleOption={(value) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "saveType",
                                    value,
                                )}
                        />
                    </div>

                    <label>
                        <header class="nimble-header">
                            <h5
                                class="nimble-field__label nimble-heading"
                                data-heading-variant="field"
                            >
                                Custom Save DC
                            </h5>
                        </header>

                        <input
                            type="number"
                            value={node.saveDC}
                            onchange={({ target }) =>
                                updateEffectNode(
                                    document,
                                    effects,
                                    node,
                                    "saveDC",
                                    target.value,
                                )}
                        />
                    </label>
                </div>
            </div>

            <ul>
                <li>
                    <header>
                        <h4 class="nimble-heading" data-heading-variant="field">
                            Shared Rolls
                        </h4>

                        <button
                            class="nimble-button"
                            data-button-variant="icon"
                            aria-label="Add shared damage roll"
                            data-tooltip="Add shared damage roll"
                            type="button"
                            onclick={(event) =>
                                createEffectNode(
                                    document,
                                    effects,
                                    "damage",
                                    event,
                                    "sharedRolls",
                                )}
                        >
                            <i class="fa-solid fa-square-plus"></i>
                        </button>
                    </header>

                    {#if node?.sharedRolls?.length}
                        <ul>
                            {#each node.sharedRolls as childNode}
                                {@render getNodeSnippet(childNode?.type)(
                                    childNode,
                                    node,
                                )}
                            {/each}
                        </ul>
                    {:else}
                        <span>None</span>
                    {/if}
                </li>

                <li>
                    <header>
                        <h4 class="nimble-heading" data-heading-variant="field">
                            On Failed Save
                        </h4>

                        <button
                            class="nimble-button"
                            data-button-variant="icon"
                            aria-label="Add on-fail effect"
                            data-tooltip="Add on-fail effect"
                            type="button"
                            onclick={toggleEffectCreationOptions}
                        >
                            <i class="fa-solid fa-square-plus"></i>
                        </button>
                    </header>

                    {@render EffectCreationButtons(
                        node,
                        "failedSave",
                        node.sharedRolls[0]?.id,
                    )}

                    {#if node?.on?.failedSave?.length}
                        <ul>
                            {#each node.on.failedSave as childNode}
                                {@render getNodeSnippet(childNode?.type)(
                                    childNode,
                                    node,
                                )}
                            {/each}
                        </ul>
                    {:else}
                        <span>No additional effects</span>
                    {/if}
                </li>

                <li>
                    <header>
                        <h4 class="nimble-heading" data-heading-variant="field">
                            On Passed Save
                        </h4>

                        <button
                            class="nimble-button"
                            data-button-variant="icon"
                            aria-label="Add on-save effect"
                            data-tooltip="Add on-save effect"
                            type="button"
                            onclick={toggleEffectCreationOptions}
                        >
                            <i class="fa-solid fa-square-plus"></i>
                        </button>
                    </header>

                    {@render EffectCreationButtons(
                        node,
                        "passedSave",
                        node.sharedRolls[0]?.id,
                    )}

                    {#if node?.on?.passedSave?.length}
                        <ul>
                            {#each node.on.passedSave as childNode}
                                {@render getNodeSnippet(childNode?.type)(
                                    childNode,
                                    node,
                                )}
                            {/each}
                        </ul>
                    {:else}
                        <span>No additional effects</span>
                    {/if}
                </li>
            </ul>
        </details>
    </li>
{/snippet}

{#snippet ConditionNode(node, parentNode = null)}
    <li data-node-id={node.id}>
        <header>
            <h4 class="nimble-heading" data-heading-variant="field">
                Status Condition
            </h4>

            <button
                class="nimble-button"
                data-button-variant="icon"
                aria-label="Delete condition"
                data-tooltip="Delete condition"
                type="button"
                onclick={() => deleteEffectNode(document, effects, node.id)}
            >
                <i class="fa-solid fa-trash"></i>
            </button>
        </header>

        <div
            class="nimble-effect-main-config nimble-effect-main-config--no-sub-config"
        >
            <div class="nimble-config-block nimble-card">
                <label class="nimble-field" data-field-variant="stacked">
                    <select
                        onchange={({ target }) =>
                            updateEffectNode(
                                document,
                                effects,
                                node,
                                "condition",
                                target.value,
                            )}
                    >
                        {#each Object.entries(conditions) as [value, label]}
                            <option {value} selected={value === node.condition}>
                                {label}
                            </option>
                        {/each}
                    </select>
                </label>
            </div>
        </div>
    </li>
{/snippet}

{#snippet DamageOutcomeNode(node, parentNode = null)}
    <li data-node-id={node.id}>
        <header>
            <h4 class="nimble-heading" data-heading-variant="field">
                Damage Outcome
            </h4>

            <button
                class="nimble-button"
                data-button-variant="icon"
                aria-label="Delete Damage Outcome"
                data-tooltip="Delete Damage Outcome"
                type="button"
                onclick={() => deleteEffectNode(document, effects, node.id)}
            >
                <i class="fa-solid fa-trash"></i>
            </button>
        </header>

        <div
            class="nimble-effect-main-config nimble-effect-main-config--no-sub-config"
        >
            <div class="nimble-config-block nimble-card">
                <label
                    class="nimble-field"
                    style="gap: 0;"
                    data-field-variant="stacked"
                >
                    {#if parentNode.type === "savingThrow"}
                        <header>
                            <h4
                                class="nimble-heading"
                                data-heading-variant="field"
                            >
                                Damage Outcome
                            </h4>
                        </header>
                    {/if}

                    <select
                        onchange={({ target }) =>
                            updateEffectNode(
                                document,
                                effects,
                                node,
                                "outcome",
                                target.value,
                            )}
                    >
                        {#each damageOutcomes as { value, label }}
                            <option {value} selected={value === node.outcome}>
                                {label}
                            </option>
                        {/each}
                    </select>
                </label>
            </div>
        </div>
    </li>
{/snippet}

{#snippet TextNode(node, parentNode = null)}
    <li data-node-id={node.id}>
        <header>
            <h4 class="nimble-heading" data-heading-variant="field">Note</h4>

            <button
                class="nimble-button"
                data-button-variant="icon"
                aria-label="Delete Note"
                data-tooltip="Delete Note"
                type="button"
                onclick={() => deleteEffectNode(document, effects, node.id)}
            >
                <i class="fa-solid fa-trash"></i>
            </button>
        </header>

        <div
            class="nimble-effect-main-config nimble-effect-main-config--no-sub-config"
            style="--nimble-card-width: 275px;"
        >
            <div class="nimble-config-block nimble-card">
                <textarea
                    rows="3"
                    onchange={({ target }) =>
                        updateEffectNode(
                            document,
                            effects,
                            node,
                            "text",
                            target.value,
                        )}
                    value={node.text}
                ></textarea>

                <div style="width: 100%; flex-grow: 1;">
                    <header class="nimble-header">
                        <h5
                            class="nimble-field__label nimble-heading"
                            data-heading-variant="field"
                        >
                            Note Type
                        </h5>
                    </header>

                    <TagGroup
                        options={noteTypes}
                        selectedOptions={[node.noteType]}
                        toggleOption={(value) =>
                            updateEffectNode(
                                document,
                                effects,
                                node,
                                "noteType",
                                value,
                            )}
                    />
                </div>
            </div>
        </div>
    </li>
{/snippet}

<style lang="scss">
    .nimble-effect-tree {
        --tree-clr: #dfddd5;
        --tree-font-size: var(--nimble-sm-text);
        --tree-item-height: 2;
        --tree-offset: 0.375rem;
        --tree-thickness: 2px;
        --tree-style: solid;

        --nimble-heading-line-height: var(--tree-item-height);
        --nimble-heading-margin: 0 0.375rem;

        margin-block-start: 1.25rem;
    }

    .nimble-effect-tree .nimble-field__label {
        text-indent: 0;
    }

    .nimble-effect-tree header {
        display: flex;
        align-items: baseline;
    }

    .nimble-effect-tree summary {
        position: relative;

        * {
            display: inline !important;
        }
    }

    .nimble-effect-tree ul {
        display: grid;
        list-style: none;
        font-size: var(--tree-font-size);
        margin-block: 0.75rem 0;
    }

    .nimble-effect-tree li {
        line-height: var(--tree-item-height);
        padding-inline-start: var(--tree-offset);
        border-left: var(--tree-thickness) var(--tree-style) var(--tree-clr);
        position: relative;
        text-indent: 0.5rem;
        margin-bottom: 0;
        transform: translateY(-1px);

        &:last-child {
            border-color: transparent; /* hide (not remove!) border on last li element*/
        }

        & span {
            display: block;
            font-size: var(--nimble-xs-text);
            font-weight: 200;
            opacity: 0.65;
            text-indent: 1rem;
        }

        &::before {
            content: "";
            position: absolute;
            top: calc(
                var(--tree-item-height) / 2 * -1 * var(--tree-font-size) +
                    var(--tree-thickness) - 2.5px
            );
            left: calc(var(--tree-thickness) * -1 + 0.5px);
            width: calc(var(--tree-offset) + var(--tree-thickness) * 2);
            height: calc(var(--tree-item-height) * var(--tree-font-size));
            border-left: var(--tree-thickness) var(--tree-style) var(--tree-clr);
            border-bottom: var(--tree-thickness) var(--tree-style)
                var(--tree-clr);
        }
    }

    .nimble-effect-main-config {
        --nimble-card-padding: 0.375rem;
        --nimble-heading-margin: 0;

        max-width: 22rem;
        width: fit-content;
        margin-block-end: 0;
        margin-inline-start: 1.25rem;
        padding-block-start: 0.5rem;
        padding-inline-start: 0.75rem;
        border-inline-start: var(--tree-thickness) var(--tree-style)
            var(--tree-clr);

        &--roll {
            width: 100%;
        }

        &--no-sub-config {
            border-inline-start: 0;
            margin-inline-start: 0;
            padding-block-start: 0.25rem;
            margin-block-end: 0.25rem;
        }

        .nimble-card {
            gap: 0;
            text-indent: 0;
        }

        .nimble-button {
            --nimble-button-min-width: var(--input-height);
            --nimble-button-height: var(--input-height);

            align-self: end;
        }
    }

    textarea {
        width: 100%;
        padding: 0.375rem;
        resize: none;
    }
</style>
