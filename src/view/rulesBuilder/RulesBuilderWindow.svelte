<script lang="ts">
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

	interface Props {
		document: NimbleBaseItem;
	}

	const { document: item }: Props = $props();

	const rules = $derived((item.reactive.system as unknown as { rules: RuleSource[] }).rules);
	const allDisabled = $derived(rules.length > 0 && rules.every((r) => r.disabled));

	let pickerOpen = $state(false);
	let advancedMode = $state(false);

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

	async function pickRule(ruleKey: string) {
		await item.rules.addRule({ type: ruleKey });
		pickerOpen = false;
	}
</script>

<section class="nimble-rules-builder-window">
	<header class="nimble-rules-builder-window__header">
		<div class="nimble-rules-builder-window__header-left">
			<button
				type="button"
				class="nimble-button nimble-rules-builder-window__add"
				data-button-variant="basic"
				class:nimble-rules-builder-window__add--open={pickerOpen}
				onclick={() => (pickerOpen = !pickerOpen)}
				aria-expanded={pickerOpen}
			>
				<i class="fa-solid {pickerOpen ? 'fa-xmark' : 'fa-plus'}"></i>
				{pickerOpen ? 'Cancel' : 'Add Rule'}
			</button>

			<span class="nimble-rules-builder-window__count">
				{rules.length}
				{rules.length === 1 ? 'rule' : 'rules'}
			</span>
		</div>

		<div class="nimble-rules-builder-window__header-right">
			{#if rules.length > 0}
				<button type="button" class="nimble-button" data-button-variant="basic" onclick={toggleAll}>
					<i class="fa-solid {allDisabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
					{allDisabled ? 'Enable all' : 'Disable all'}
				</button>
			{/if}

			<label
				class="nimble-rules-builder-window__advanced-toggle"
				data-tooltip="Reveals identifier, priority, predicate, drag-reorder, and the raw JSON edit on every rule."
			>
				<input type="checkbox" bind:checked={advancedMode} />
				<span>Show advanced</span>
			</label>
		</div>
	</header>

	<div class="nimble-rules-builder-window__body">
		{#if pickerOpen}
			<RuleTypePicker onPick={pickRule} />
		{:else if rules.length === 0}
			<p class="nimble-rules-builder-window__empty">
				No rules yet. Click <strong>Add Rule</strong> to pick a type.
			</p>
		{:else}
			<ul
				class="nimble-rules-builder-window__list"
				use:reorderable={{ enabled: advancedMode, onReorder: handleReorder }}
			>
				{#each rules as rule, index (rule.id)}
					<li class="nimble-rules-builder-window__list-item">
						<RuleCard
							{rule}
							manager={item.rules}
							advanced={advancedMode}
							onMoveUp={index === 0 ? undefined : () => moveRule(rule.id, -1)}
							onMoveDown={index === rules.length - 1 ? undefined : () => moveRule(rule.id, 1)}
							onDelete={() => item.rules.deleteRule(rule.id)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<style lang="scss">
	.nimble-rules-builder-window {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		min-height: 0;
	}

	.nimble-rules-builder-window__header {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		border-bottom: 1px solid hsla(41, 18%, 54%, 25%);
	}

	.nimble-rules-builder-window__header-left,
	.nimble-rules-builder-window__header-right {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.nimble-rules-builder-window__add {
		font-weight: 600;

		&--open {
			background: var(--nimble-selected-tag-background-color);
		}
	}

	.nimble-rules-builder-window__count {
		color: var(--color-text-dark-secondary);
		font-size: var(--nimble-sm-text);
	}

	.nimble-rules-builder-window__advanced-toggle {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		font-size: var(--nimble-xs-text);
		color: var(--color-text-dark-secondary);
		cursor: pointer;
		user-select: none;

		input {
			margin: 0;
		}
	}

	.nimble-rules-builder-window__body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 0.5rem 0.5rem;
	}

	.nimble-rules-builder-window__empty {
		padding: 1.5rem 1rem;
		color: var(--color-text-dark-secondary);
		text-align: center;
		font-style: italic;
	}

	.nimble-rules-builder-window__list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;

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

	.nimble-rules-builder-window__list-item {
		display: contents;
	}
</style>
