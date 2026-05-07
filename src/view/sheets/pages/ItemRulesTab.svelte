<script lang="ts">
	import { getContext } from 'svelte';

	import type { NimbleBaseItem } from '#documents/item/base.svelte.js';
	import { reorderable } from '#view/rulesBuilder/actions/reorderable.svelte.js';
	import RuleCard from '#view/rulesBuilder/components/RuleCard.svelte';
	import RuleTypePicker from '#view/rulesBuilder/components/RuleTypePicker.svelte';

	interface RuleSource {
		id: string;
		type: string;
		disabled?: boolean;
		[key: string]: unknown;
	}

	const item: NimbleBaseItem = getContext('document');
	const rules = $derived((item.reactive.system as unknown as { rules: RuleSource[] }).rules);
	const allDisabled = $derived(rules.length > 0 && rules.every((r) => r.disabled));

	async function handleReorder(ids: string[]) {
		await item.rules.reorderRules(ids);
	}

	async function moveRule(ruleId: string, delta: -1 | 1) {
		const order = rules.map((r) => r.id);
		const idx = order.indexOf(ruleId);
		if (idx < 0) return;
		const target = idx + delta;
		if (target < 0 || target >= order.length) return;
		[order[idx], order[target]] = [order[target], order[idx]];
		await item.rules.reorderRules(order);
	}

	async function toggleAll() {
		if (allDisabled) await item.rules.enableAllRules();
		else await item.rules.disableAllRules();
	}
</script>

<section class="nimble-sheet__body nimble-rules-tab__body">
	<header class="nimble-rules-tab__header">
		<span class="nimble-rules-tab__count">
			{rules.length}
			{rules.length === 1 ? 'rule' : 'rules'}
		</span>

		{#if rules.length > 0}
			<button type="button" class="nimble-button" data-button-variant="basic" onclick={toggleAll}>
				<i class="fa-solid {allDisabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
				{allDisabled ? 'Enable all' : 'Disable all'}
			</button>
		{/if}
	</header>

	{#if rules.length === 0}
		<p class="nimble-rules-tab__empty">No rules yet. Pick a rule type below to add one.</p>
	{:else}
		<ul
			class="nimble-rules-tab__list"
			use:reorderable={{ enabled: true, onReorder: handleReorder }}
		>
			{#each rules as rule, index (rule.id)}
				<li class="nimble-rules-tab__list-item">
					<RuleCard
						{rule}
						manager={item.rules}
						onMoveUp={index === 0 ? undefined : () => moveRule(rule.id, -1)}
						onMoveDown={index === rules.length - 1 ? undefined : () => moveRule(rule.id, 1)}
						onDelete={() => item.rules.deleteRule(rule.id)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<footer class="nimble-sheet__footer nimble-rules-tab__footer">
	<h4 class="nimble-heading" data-heading-variant="section">Add a rule</h4>
	<RuleTypePicker onPick={(ruleKey) => item.rules.addRule({ type: ruleKey })} />
</footer>

<style lang="scss">
	.nimble-rules-tab__body {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.nimble-rules-tab__header {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0;
	}

	.nimble-rules-tab__count {
		color: var(--color-text-dark-secondary);
		font-size: var(--nimble-sm-text);
	}

	.nimble-rules-tab__empty {
		padding: 1rem;
		color: var(--color-text-dark-secondary);
		text-align: center;
		font-style: italic;
	}

	.nimble-rules-tab__list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;

		// Drop-target placeholder rendered by the reorderable action.
		:global(.nimble-reorderable__placeholder) {
			height: 0.25rem;
			margin: 0.125rem 0;
			background: var(--nimble-accent-color);
			border-radius: 2px;
		}

		:global(.nimble-reorderable__item--source-hidden) {
			opacity: 0.35;
		}
	}

	.nimble-rules-tab__list-item {
		display: contents;
	}

	.nimble-rules-tab__footer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}
</style>
