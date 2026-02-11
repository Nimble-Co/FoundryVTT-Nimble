<script lang="ts">
	import type { NimbleBaseItem } from '../../../documents/item/base.js';

	function updateRule(event: Event, ruleId: string): void {
		const target = event.target as HTMLTextAreaElement | null;

		if (!target) return;

		item.rules.updateRule(ruleId, target?.value);
	}

	import { getContext } from 'svelte';

	import overrideTextAreaBehavior from '../../../utils/overrideTextAreaBehavior.js';

	const { ruleTypes } = CONFIG.NIMBLE;

	let item: NimbleBaseItem = getContext('document');
	let rules = $derived(item.reactive.system.rules);
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	{#each rules as rule (rule.id)}
		{@const { ...ruleData } = rule}
		{@const ruleInstance = item.rules.get(rule.id)}

		<div class="nimble-code-block nimble-code-block--rule">
			<header class="nimble-section-header">
				<h4 class="nimble-heading" data-heading-variant="section">
					{rule.label || 'New Rule'} ({ruleTypes[rule.type] ?? rule.type})
				</h4>

				{#if ruleInstance}
					<i
						class="nimble-rule-help-icon fa-solid fa-circle-question"
						data-tooltip={ruleInstance.tooltipInfo()}
						data-tooltip-direction="UP"
						data-tooltip-class="nimble-tooltip"
					>
					</i>
				{:else}
					<i
						class="nimble-rule-help-icon fa-solid fa-circle-exclamation"
						data-tooltip="Unknown rule type: {rule.type}"
						data-tooltip-direction="UP"
						data-tooltip-class="nimble-tooltip"
						style="color: var(--color-level-error);"
					>
					</i>
				{/if}

				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Delete Rule"
					data-tooltip="Delete Rule"
					onclick={() => {
						item.rules.deleteRule(rule.id);
					}}
				>
					<i class="fa-solid fa-trash"></i>
				</button>
			</header>

			<textarea
				class="nimble-code-block__text-area"
				value={JSON.stringify(ruleData, null, 2)}
				rows="11"
				autocapitalize="off"
				autocomplete="off"
				spellcheck={false}
				wrap="soft"
				onchange={(event) => updateRule(event, rule.id)}
				onkeydown={overrideTextAreaBehavior}
				disabled={item.isEmbedded}
			></textarea>
		</div>
	{:else}
		<p style="padding: 1rem; text-align: center; color: var(--color-text-dark-secondary);">
			{#if item.isEmbedded}
				This item has no rules. Items owned by actors cannot have rules added or modified. To add
				rules, edit this item in a compendium or create a new unowned item.
			{:else}
				No rules defined for this item. Use the buttons below to add rules.
			{/if}
		</p>
	{/each}
</section>

{#if !item.isEmbedded}
	<footer class="nimble-sheet__footer nimble-sheet__footer--rules">
		<h4 class="nimble-heading" data-heading-variant="section" style="grid-column: 1 / -1;">
			Add Rule
		</h4>

		{#each Object.entries(ruleTypes) as [ruleKey, label]}
			<button
				class="nimble-button"
				data-button-variant="basic"
				aria-label="Add Rule"
				onclick={() => item.rules.addRule({ type: ruleKey })}
			>
				{label}
			</button>
		{/each}
	</footer>
{/if}

<style lang="scss">
	.nimble-sheet__body {
		--nimble-sheet-body-gap: 0.375rem;
		--nimble-heading-color: var(--nimble-code-editor-text-color);
	}

	.nimble-sheet__footer {
		--nimble-button-width: 100%;
		--nimble-button-padding: 0.25rem 0.375rem;
		--nimble-button-font-size: var(--nimble-xs-text);
	}

	.nimble-rule-help-icon {
		font-size: var(--nimble-sm-text);
	}
</style>
