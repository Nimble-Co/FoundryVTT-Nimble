<script lang="ts">
	import { getContext } from 'svelte';

	import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
	import type { NimbleBaseItem } from '#documents/item/base.svelte.js';
	import localize from '#utils/localize.js';
	import overrideTextAreaBehavior from '#utils/overrideTextAreaBehavior.js';
	import { reorderable } from '#view/rulesBuilder/actions/reorderable.svelte.js';
	import RulesBuilderWindow from '#view/rulesBuilder/RulesBuilderWindow.svelte';
	import { COPY_TYPE, createItemRulesTabState } from './ItemRulesTab.svelte.js';

	const item: NimbleBaseItem = getContext('document');
	const state = createItemRulesTabState(() => item);

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
			{state.rules.length}
			{state.rules.length === 1
				? localize('NIMBLE.rulesBuilder.ruleSingular')
				: localize('NIMBLE.rulesBuilder.rulePlural')}
		</span>

		<button type="button" class="nimble-button" data-button-variant="basic" onclick={openBuilder}>
			<i class="fa-solid fa-sliders"></i>
			{localize('NIMBLE.rulesBuilder.openRulesBuilder')}
		</button>
	</header>

	{#if state.rules.length === 0}
		<p class="nimble-rules-tab__empty">{localize('NIMBLE.rulesBuilder.noRulesDefined')}</p>
	{:else}
		<ul
			class="nimble-rules-tab__list"
			use:reorderable={{
				enabled: true,
				getDragPayload: state.getDragPayload,
				onCopy: state.copyRuleFromPayload,
				copyAcceptType: COPY_TYPE,
			}}
		>
			{#each state.rules as rule (rule.id)}
				{@const jsonOpen = state.jsonOpenIds.has(rule.id)}
				<li
					class="nimble-rules-tab__row"
					class:nimble-rules-tab__row--disabled={rule.disabled}
					data-reorder-id={rule.id}
					draggable="true"
					data-tooltip={localize('NIMBLE.rulesBuilder.dragToCopy')}
				>
					<div class="nimble-rules-tab__row-main">
						<span
							class="nimble-rules-tab__priority"
							data-tooltip={localize('NIMBLE.rulesBuilder.priorityApplicationOrder')}
						>
							{(rule.priority as number) ?? 1}
						</span>
						<span class="nimble-rules-tab__label">
							{rule.label || ruleTypes[rule.type] || rule.type}
						</span>
						<span class="nimble-rules-tab__type">
							{ruleTypes[rule.type] ?? rule.type}
						</span>
						{#if rule.disabled}
							<span
								class="nimble-rules-tab__badge"
								data-tooltip={localize('NIMBLE.rulesBuilder.ruleDisabled')}
							>
								<i class="fa-solid fa-toggle-off"></i>
								{localize('NIMBLE.rulesBuilder.disabled')}
							</span>
						{/if}
						<button
							type="button"
							class="nimble-button nimble-rules-tab__json-toggle"
							data-button-variant="icon"
							data-tooltip={jsonOpen
								? localize('NIMBLE.rulesBuilder.closeJsonEditor')
								: localize('NIMBLE.rulesBuilder.editRawJson')}
							aria-label={jsonOpen
								? localize('NIMBLE.rulesBuilder.closeJsonEditor')
								: localize('NIMBLE.rulesBuilder.editRawJson')}
							aria-expanded={jsonOpen}
							onclick={() => state.toggleJson(rule)}
						>
							<i class="fa-solid {jsonOpen ? 'fa-xmark' : 'fa-code'}"></i>
						</button>
					</div>

					{#if jsonOpen}
						<div class="nimble-rules-tab__json">
							<textarea
								class="nimble-code-block__text-area"
								bind:value={state.jsonDrafts[rule.id]}
								rows="11"
								autocapitalize="off"
								autocomplete="off"
								spellcheck="false"
								wrap="soft"
								onkeydown={overrideTextAreaBehavior}
							></textarea>
							<div class="nimble-rules-tab__json-controls">
								<button
									type="button"
									class="nimble-button"
									data-button-variant="basic"
									onclick={() => state.commitJson(rule.id)}
								>
									<i class="fa-solid fa-save"></i>
									{localize('NIMBLE.rulesBuilder.saveJson')}
								</button>
								{#if state.jsonErrors[rule.id]}
									<span class="nimble-rules-tab__json-error">{state.jsonErrors[rule.id]}</span>
								{/if}
							</div>
						</div>
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

		:global(.nimble-reorderable__item--source-hidden) {
			opacity: 0.35;
		}
	}

	.nimble-rules-tab__list:global(.nimble-reorderable--foreign-drag) {
		outline: 2px dashed var(--nimble-accent-color);
		outline-offset: 4px;
		border-radius: 4px;
	}

	.nimble-rules-tab__row {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;
		font-size: var(--nimble-sm-text);
		cursor: grab;

		&--disabled {
			opacity: 0.55;
		}
	}

	.nimble-rules-tab__row-main {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}

	.nimble-rules-tab__json {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		cursor: default;
	}

	.nimble-rules-tab__json-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.nimble-rules-tab__json-error {
		color: var(--color-level-error);
		font-size: var(--nimble-xs-text);
	}

	.nimble-rules-tab__json-toggle {
		margin-left: auto;
	}

	.nimble-code-block__text-area {
		width: 100%;
		font-family: var(--nimble-font-monospace, monospace);
		font-size: var(--nimble-sm-text);
		background: var(--nimble-sheet-background);
		color: inherit;
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;
	}

	.nimble-rules-tab__priority {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		min-width: 1.5rem;
		padding: 0 0.25rem;
		font-size: var(--nimble-xs-text);
		font-weight: 600;
		color: var(--color-text-dark-secondary);
		background: var(--nimble-sheet-background, transparent);
		border-radius: 999px;
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
