<script lang="ts">
	import { getContext } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
	import type { NimbleBaseItem } from '#documents/item/base.svelte.js';
	import overrideTextAreaBehavior from '#utils/overrideTextAreaBehavior.js';
	import { reorderable } from '#view/rulesBuilder/actions/reorderable.svelte.js';
	import RulesBuilderWindow from '#view/rulesBuilder/RulesBuilderWindow.svelte';

	interface RuleSource {
		id: string;
		type: string;
		label?: string;
		disabled?: boolean;
		[key: string]: unknown;
	}

	const item: NimbleBaseItem = getContext('document');
	const rawRules = $derived((item.reactive.system as unknown as { rules: RuleSource[] }).rules);

	// Per-row JSON-editor state. Lets a user repair a rule whose schema the
	// builder can't render — e.g. a corrupt source from an older version.
	const jsonOpenIds = $state<Set<string>>(new SvelteSet());
	const jsonDrafts = $state<Record<string, string>>({});
	const jsonErrors = $state<Record<string, string | null>>({});

	function toggleJson(rule: RuleSource) {
		if (jsonOpenIds.has(rule.id)) {
			jsonOpenIds.delete(rule.id);
			return;
		}
		jsonDrafts[rule.id] = JSON.stringify(rule, null, 2);
		jsonErrors[rule.id] = null;
		jsonOpenIds.add(rule.id);
	}

	async function commitJson(ruleId: string) {
		try {
			const parsed = JSON.parse(jsonDrafts[ruleId] ?? '');
			await item.rules.updateRule(ruleId, parsed);
			jsonErrors[ruleId] = null;
			jsonOpenIds.delete(ruleId);
		} catch (err) {
			jsonErrors[ruleId] = err instanceof Error ? err.message : 'Invalid JSON';
		}
	}
	// Display order = application order (sort by ascending priority, stable).
	const rules = $derived(
		[...rawRules].sort((a, b) => ((a.priority as number) ?? 1) - ((b.priority as number) ?? 1)),
	);

	const { ruleTypes } = CONFIG.NIMBLE;

	const COPY_TYPE = 'nimble.Rule';

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

	function getDragPayload(id: string): Record<string, unknown> | null {
		const source = rules.find((r) => r.id === id);
		if (!source) return null;
		const cloned = foundry.utils.deepClone(source) as Record<string, unknown>;
		return {
			rule: cloned,
			sourceItemUuid: item.uuid,
		};
	}

	async function copyRuleFromPayload(payload: Record<string, unknown>) {
		if (payload.sourceItemUuid === item.uuid) return;
		const incoming = payload.rule as Record<string, unknown> | undefined;
		if (!incoming || typeof incoming !== 'object') return;
		const { id: _id, ...rest } = incoming;
		await item.rules.addRule(rest);
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
		<ul
			class="nimble-rules-tab__list"
			use:reorderable={{
				enabled: true,
				getDragPayload,
				onCopy: copyRuleFromPayload,
				copyAcceptType: COPY_TYPE,
			}}
		>
			{#each rules as rule (rule.id)}
				{@const jsonOpen = jsonOpenIds.has(rule.id)}
				<li
					class="nimble-rules-tab__row"
					class:nimble-rules-tab__row--disabled={rule.disabled}
					data-reorder-id={rule.id}
					draggable="true"
					data-tooltip="Drag onto another rules list to copy"
				>
					<div class="nimble-rules-tab__row-main">
						<span class="nimble-rules-tab__priority" data-tooltip="Priority (application order)">
							{(rule.priority as number) ?? 1}
						</span>
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
						<button
							type="button"
							class="nimble-button nimble-rules-tab__json-toggle"
							data-button-variant="icon"
							data-tooltip={jsonOpen ? 'Close JSON editor' : 'Edit raw JSON'}
							aria-label={jsonOpen ? 'Close JSON editor' : 'Edit raw JSON'}
							aria-expanded={jsonOpen}
							onclick={() => toggleJson(rule)}
						>
							<i class="fa-solid {jsonOpen ? 'fa-xmark' : 'fa-code'}"></i>
						</button>
					</div>

					{#if jsonOpen}
						<div class="nimble-rules-tab__json">
							<textarea
								class="nimble-code-block__text-area"
								bind:value={jsonDrafts[rule.id]}
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
									onclick={() => commitJson(rule.id)}
								>
									<i class="fa-solid fa-save"></i>
									Save JSON
								</button>
								{#if jsonErrors[rule.id]}
									<span class="nimble-rules-tab__json-error">{jsonErrors[rule.id]}</span>
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
