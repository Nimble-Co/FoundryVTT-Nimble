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

	const rawRules = $derived((item.reactive.system as unknown as { rules: RuleSource[] }).rules);

	// Sort by priority so display order matches the order Foundry actually
	// applies rules in (Actor.prepareRules uses the same stable sort).
	const rules = $derived(
		[...rawRules].sort((a, b) => ((a.priority as number) ?? 1) - ((b.priority as number) ?? 1)),
	);
	const allDisabled = $derived(rules.length > 0 && rules.every((r) => r.disabled));

	let pickerOpen = $state(false);

	async function toggleAll() {
		if (allDisabled) await item.rules.enableAllRules();
		else await item.rules.disableAllRules();
	}

	async function pickRule(ruleKey: string) {
		await item.rules.addRule({ type: ruleKey });
		pickerOpen = false;
	}

	const COPY_TYPE = 'nimble.Rule';

	// Drop target only — cards in here aren't draggable so the inline editing
	// they're built for doesn't fight with drag gestures.
	async function copyRuleFromPayload(payload: Record<string, unknown>) {
		if (payload.sourceItemUuid === item.uuid) return;
		const incoming = payload.rule as Record<string, unknown> | undefined;
		if (!incoming || typeof incoming !== 'object') return;
		const { id: _id, ...rest } = incoming;
		await item.rules.addRule(rest);
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
				use:reorderable={{
					enabled: true,
					onCopy: copyRuleFromPayload,
					copyAcceptType: COPY_TYPE,
				}}
			>
				{#each rules as rule (rule.id)}
					<li class="nimble-rules-builder-window__list-item">
						<RuleCard {rule} manager={item.rules} onDelete={() => item.rules.deleteRule(rule.id)} />
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
