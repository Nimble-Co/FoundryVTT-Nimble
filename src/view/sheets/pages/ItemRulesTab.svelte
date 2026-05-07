<script lang="ts">
	import { getContext } from 'svelte';

	import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
	import type { NimbleBaseItem } from '#documents/item/base.svelte.js';
	import RulesBuilderWindow from '#view/rulesBuilder/RulesBuilderWindow.svelte';

	interface RuleSource {
		id: string;
		type: string;
		label?: string;
		disabled?: boolean;
		[key: string]: unknown;
	}

	const item: NimbleBaseItem = getContext('document');
	const rules = $derived((item.reactive.system as unknown as { rules: RuleSource[] }).rules);

	const { ruleTypes } = CONFIG.NIMBLE;

	function openBuilder() {
		const dialog = GenericDialog.getOrCreate(
			`${item.name}: Rules Builder`,
			RulesBuilderWindow as unknown as Parameters<typeof GenericDialog.getOrCreate>[1],
			{ document: item },
			{
				uniqueId: `rules-builder-${item.uuid}`,
				icon: 'fa-solid fa-sliders',
				width: 720,
				resizable: true,
			},
		);
		dialog.render(true);
	}
</script>

<section class="nimble-sheet__body nimble-rules-tab__body">
	<header class="nimble-rules-tab__header">
		<span class="nimble-rules-tab__count">
			{rules.length}
			{rules.length === 1 ? 'rule' : 'rules'}
		</span>

		<button type="button" class="nimble-button" data-button-variant="basic" onclick={openBuilder}>
			<i class="fa-solid fa-sliders"></i>
			Open Rules Builder
		</button>
	</header>

	{#if rules.length === 0}
		<p class="nimble-rules-tab__empty">No rules defined. Open the builder to add one.</p>
	{:else}
		<ul class="nimble-rules-tab__list">
			{#each rules as rule (rule.id)}
				<li class="nimble-rules-tab__row" class:nimble-rules-tab__row--disabled={rule.disabled}>
					<span class="nimble-rules-tab__label">
						{rule.label || ruleTypes[rule.type] || rule.type}
					</span>
					<span class="nimble-rules-tab__type">
						{ruleTypes[rule.type] ?? rule.type}
					</span>
					{#if rule.disabled}
						<span class="nimble-rules-tab__badge" data-tooltip="This rule is disabled">
							<i class="fa-solid fa-toggle-off"></i>
							Disabled
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

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
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-rules-tab__row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;
		font-size: var(--nimble-sm-text);

		&--disabled {
			opacity: 0.55;
		}
	}

	.nimble-rules-tab__label {
		flex-grow: 1;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nimble-rules-tab__type {
		padding: 0.125rem 0.375rem;
		font-size: var(--nimble-xs-text);
		color: var(--color-text-dark-secondary);
		background: var(--nimble-sheet-background, transparent);
		border-radius: 4px;
	}

	.nimble-rules-tab__badge {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		padding: 0.125rem 0.375rem;
		font-size: var(--nimble-xs-text);
		color: var(--color-text-dark-secondary);
	}
</style>
