<script lang="ts">
	import localize from '#utils/localize.js';
	import { reorderable } from '#view/rulesBuilder/actions/reorderable.svelte.js';
	import RuleCard from '#view/rulesBuilder/components/RuleCard.svelte';
	import RuleTypePicker from '#view/rulesBuilder/components/RuleTypePicker.svelte';
	import {
		COPY_TYPE,
		createRulesBuilderWindowState,
	} from '#view/rulesBuilder/RulesBuilderWindow.svelte.js';
	import type { RulesBuilderWindowProps } from '#view/rulesBuilder/types.js';

	const { document: item }: RulesBuilderWindowProps = $props();

	const state = createRulesBuilderWindowState(() => item);
</script>

<section class="nimble-rules-builder-window">
	<header class="nimble-rules-builder-window__header">
		<div class="nimble-rules-builder-window__header-left">
			<button
				type="button"
				class="nimble-button nimble-rules-builder-window__add"
				data-button-variant="basic"
				class:nimble-rules-builder-window__add--open={state.pickerOpen}
				onclick={() => state.setPickerOpen(!state.pickerOpen)}
				aria-expanded={state.pickerOpen}
			>
				<i class="fa-solid {state.pickerOpen ? 'fa-xmark' : 'fa-plus'}"></i>
				{state.pickerOpen
					? localize('NIMBLE.rulesBuilder.cancel')
					: localize('NIMBLE.rulesBuilder.addRule')}
			</button>

			<span class="nimble-rules-builder-window__count">
				{state.rules.length}
				{state.rules.length === 1
					? localize('NIMBLE.rulesBuilder.ruleSingular')
					: localize('NIMBLE.rulesBuilder.rulePlural')}
			</span>
		</div>

		<div class="nimble-rules-builder-window__header-right">
			{#if state.rules.length > 0}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="basic"
					onclick={state.toggleCollapseAll}
				>
					<i class="fa-solid {state.allCollapsed ? 'fa-angles-down' : 'fa-angles-up'}"></i>
					{state.allCollapsed
						? localize('NIMBLE.rulesBuilder.expandAll')
						: localize('NIMBLE.rulesBuilder.collapseAll')}
				</button>
				<button
					type="button"
					class="nimble-button"
					data-button-variant="basic"
					onclick={state.toggleAll}
				>
					<i class="fa-solid {state.allDisabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
					{state.allDisabled
						? localize('NIMBLE.rulesBuilder.enableAll')
						: localize('NIMBLE.rulesBuilder.disableAll')}
				</button>
			{/if}
		</div>
	</header>

	<div class="nimble-rules-builder-window__body">
		{#if state.pickerOpen}
			<RuleTypePicker onPick={state.pickRule} />
		{:else if state.rules.length === 0}
			<p class="nimble-rules-builder-window__empty">
				{localize('NIMBLE.rulesBuilder.emptyHint', {
					addRule: localize('NIMBLE.rulesBuilder.addRule'),
				})}
			</p>
		{:else}
			<ul
				class="nimble-rules-builder-window__list"
				use:reorderable={{
					enabled: true,
					onCopy: state.copyRuleFromPayload,
					copyAcceptType: COPY_TYPE,
				}}
			>
				{#each state.rules as rule (rule.id)}
					<li class="nimble-rules-builder-window__list-item">
						<RuleCard
							{rule}
							manager={item.rules}
							previewDomain={state.previewDomain}
							collapsed={state.collapsedIds.has(rule.id)}
							onToggleCollapse={() => state.toggleCollapse(rule.id)}
							onDelete={() => item.rules.deleteRule(rule.id)}
							document={item}
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

		:global(.nimble-reorderable__item--source-hidden) {
			opacity: 0.35;
		}
	}

	.nimble-rules-builder-window__list:global(.nimble-reorderable--foreign-drag) {
		outline: 2px dashed var(--nimble-accent-color);
		outline-offset: 4px;
		border-radius: 4px;
	}

	.nimble-rules-builder-window__list-item {
		display: block;
	}
</style>
