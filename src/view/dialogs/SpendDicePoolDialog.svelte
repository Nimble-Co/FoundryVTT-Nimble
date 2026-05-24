<script lang="ts">
	import type { NimbleCharacter } from '#documents/actor/character.js';
	import type SpendDicePoolDialog from '#documents/dialogs/SpendDicePoolDialog.svelte.js';
	import {
		type DicePoolConsumer,
		getDicePoolConsumers,
	} from '#utils/dicePool/dicePoolConsumers.js';
	import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
	import { getPools } from '#utils/dicePool/dicePoolSync.js';
	import type { DicePoolState } from '#utils/dicePool/types.js';
	import { createSubscriber } from 'svelte/reactivity';
	import localize from '../../utils/localize.js';

	let {
		actor,
		poolId,
		dialog,
	}: {
		actor: NimbleCharacter;
		poolId: string;
		dialog: SpendDicePoolDialog;
	} = $props();

	// Reactive subscription so the dialog updates when pool or items change mid-flow.
	const POOL_HOOK_NAMES = [
		'nimble.dicePool.changed',
		'nimble.dicePool.refilled',
		'updateItem',
		'createItem',
		'deleteItem',
		'updateActor',
	] as const;

	const subscribePoolState = createSubscriber((listener) => {
		const hooksApi = Hooks as unknown as {
			on: (hook: string, listener: () => void) => number;
			off: (hook: string, id: number) => void;
		};
		const ids = POOL_HOOK_NAMES.map((name) => ({ name, id: hooksApi.on(name, listener) }));
		return () => {
			for (const { name, id } of ids) hooksApi.off(name, id);
		};
	});

	const pool = $derived.by((): DicePoolState | null => {
		subscribePoolState();
		const found = getPools(actor).find((p) => p.id === poolId);
		return found ?? null;
	});

	const consumers = $derived.by((): DicePoolConsumer[] => {
		if (!pool) return [];
		return getDicePoolConsumers(actor, pool);
	});

	// Selection state.
	let selectedConsumerKey = $state<string | null>(null);
	let selectedIndices = $state<Set<number>>(new Set());
	let expandedConsumerKey = $state<string | null>(null);
	let livePreviewTotal = $state<number | null>(null);

	function consumerKey(c: DicePoolConsumer): string {
		return `${c.itemId}:${c.ruleId}`;
	}

	const selectedConsumer = $derived.by((): DicePoolConsumer | null => {
		if (!selectedConsumerKey) return null;
		return consumers.find((c) => consumerKey(c) === selectedConsumerKey) ?? null;
	});

	const selectedFaces = $derived.by((): number[] => {
		if (!pool) return [];
		const result: number[] = [];
		for (let i = 0; i < pool.faces.length; i += 1) {
			if (selectedIndices.has(i)) result.push(pool.faces[i]);
		}
		return result;
	});

	const selectedCount = $derived(selectedFaces.length);
	const selectedSum = $derived(selectedFaces.reduce((a, b) => a + b, 0));

	// Auto-clear stale selection if the consumer list changes such that
	// the selected consumer disappears.
	$effect(() => {
		if (!selectedConsumerKey) return;
		const stillThere = consumers.some((c) => consumerKey(c) === selectedConsumerKey);
		if (!stillThere) {
			selectedConsumerKey = null;
			selectedIndices = new Set();
		}
	});

	// Drop any selected indices that no longer exist (pool may shrink mid-dialog
	// if another action consumes dice). Player-driven selection only — no
	// auto-pick on entering State B.
	$effect(() => {
		if (!selectedConsumer || !pool) {
			if (selectedIndices.size > 0) selectedIndices = new Set();
			return;
		}
		const next = new Set<number>();
		for (const i of selectedIndices) {
			if (i < pool.faces.length) next.add(i);
		}
		if (next.size !== selectedIndices.size || [...next].some((i) => !selectedIndices.has(i))) {
			selectedIndices = next;
		}
	});

	function substituteFormula(formula: string, count: number, sum: number): string {
		return formula.replace(/@n\b/g, String(count)).replace(/@sum\b/g, String(sum));
	}

	/**
	 * Deterministically evaluate the consumer's effect formula for the
	 * live preview. Returns null if the formula can't be parsed or count is 0.
	 */
	async function evaluateEffectPreview(
		formula: string,
		count: number,
		sum: number,
	): Promise<number | null> {
		if (count < 1) return null;
		try {
			const substituted = substituteFormula(formula, count, sum);
			const RollCls = (globalThis as unknown as { Roll: typeof Roll }).Roll;
			const roll = new RollCls(substituted, actor.getRollData());
			await roll.evaluate({ allowInteractive: false } as Parameters<Roll['evaluate']>[0]);
			return roll.total ?? null;
		} catch {
			return null;
		}
	}

	// Recompute the live preview whenever the selection or formula changes.
	$effect(() => {
		const formula = selectedConsumer?.effectFormula ?? null;
		const count = selectedCount;
		const sum = selectedSum;
		if (!formula || count < 1) {
			livePreviewTotal = null;
			return;
		}
		let cancelled = false;
		void evaluateEffectPreview(formula, count, sum).then((total) => {
			if (!cancelled) livePreviewTotal = total;
		});
		return () => {
			cancelled = true;
		};
	});

	function selectConsumer(c: DicePoolConsumer): void {
		selectedConsumerKey = consumerKey(c);
		selectedIndices = new Set();
	}

	function toggleConsumerExpansion(event: MouseEvent, c: DicePoolConsumer): void {
		event.stopPropagation();
		const key = consumerKey(c);
		expandedConsumerKey = expandedConsumerKey === key ? null : key;
	}

	function toggleDie(index: number): void {
		const next = new Set(selectedIndices);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		selectedIndices = next;
	}

	function backToFeatures(): void {
		selectedConsumerKey = null;
		selectedIndices = new Set();
		livePreviewTotal = null;
	}

	async function enrichDescription(html: string): Promise<string> {
		const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;
		return await TextEditorImpl.enrichHTML(html, {
			rollData: actor.getRollData(),
			relativeTo: actor,
		} as Parameters<typeof TextEditorImpl.enrichHTML>[1]);
	}

	async function postChatCard(
		consumer: DicePoolConsumer,
		spentFaces: number[],
		effectRoll: Roll,
	): Promise<void> {
		if (!pool) return;
		const ChatMessageCls = (globalThis as unknown as { ChatMessage: typeof ChatMessage })
			.ChatMessage;
		const speaker = ChatMessageCls.getSpeaker({ actor });

		const headerLine = `<strong>${foundry.utils.escapeHTML(consumer.itemName)}</strong>`;
		const subLine = foundry.utils.escapeHTML(
			localize('NIMBLE.dicePoolTracker.spendDialog.chat.spent', {
				count: String(spentFaces.length),
				label: pool.label,
				faces: spentFaces.join(', '),
			}),
		);
		const flavor = `${headerLine}<div class="nimble-dice-pool-spend-flavor">${subLine}</div>`;

		await effectRoll.toMessage({
			speaker,
			flavor,
		} as Parameters<Roll['toMessage']>[0]);
	}

	async function onSpend(): Promise<void> {
		if (!pool || !selectedConsumer || selectedCount < 1) return;

		const consumer = selectedConsumer;
		const spentFaces = pool.faces.filter((_, i) => selectedIndices.has(i));
		const nextFaces = pool.faces.filter((_, i) => !selectedIndices.has(i));

		await setPoolFaces(actor, pool.id, nextFaces);

		const substituted = substituteFormula(
			consumer.effectFormula ?? '0',
			spentFaces.length,
			spentFaces.reduce((a, b) => a + b, 0),
		);
		const RollCls = (globalThis as unknown as { Roll: typeof Roll }).Roll;
		const effectRoll = new RollCls(substituted, actor.getRollData());
		await effectRoll.evaluate();

		await postChatCard(consumer, spentFaces, effectRoll);

		await dialog.submitSpend({
			spentFaces,
			presetItemId: consumer.itemId,
			presetRuleId: consumer.ruleId,
			effectTotal: effectRoll.total ?? null,
		});
	}

	function onCancel(): void {
		dialog.close();
	}
</script>

<article class="nimble-sheet__body spend-dice-pool-dialog">
	{#if !pool}
		<p class="spend-dice-pool-dialog__empty">
			{localize('NIMBLE.dicePoolTracker.spendDialog.poolMissing')}
		</p>
	{:else if consumers.length === 0}
		<p class="spend-dice-pool-dialog__empty">
			{localize('NIMBLE.dicePoolTracker.spendDialog.noConsumers')}
		</p>
	{:else}
		<header class="spend-dice-pool-dialog__heading">
			<h3>{pool.label}</h3>
			<span class="spend-dice-pool-dialog__heading-meta">
				{localize('NIMBLE.dicePoolTracker.spendDialog.poolMeta', {
					count: String(pool.faces.length),
					max: String(pool.max),
				})}
			</span>
		</header>

		<section class="spend-dice-pool-dialog__features">
			{#each consumers as consumer (consumerKey(consumer))}
				{@const key = consumerKey(consumer)}
				{@const isSelected = key === selectedConsumerKey}
				{@const isExpanded = key === expandedConsumerKey}
				<div
					class="spend-dice-pool-dialog__feature"
					class:spend-dice-pool-dialog__feature--selected={isSelected}
				>
					<button
						type="button"
						class="spend-dice-pool-dialog__feature-row"
						onclick={() => selectConsumer(consumer)}
					>
						{#if consumer.itemImg}
							<img class="spend-dice-pool-dialog__feature-img" src={consumer.itemImg} alt="" />
						{:else}
							<span
								class="spend-dice-pool-dialog__feature-img spend-dice-pool-dialog__feature-img--placeholder"
							>
								<i class="fa-solid fa-star"></i>
							</span>
						{/if}
						<span class="spend-dice-pool-dialog__feature-name">
							{consumer.itemName}
						</span>
						<span
							class="spend-dice-pool-dialog__feature-chevron"
							class:spend-dice-pool-dialog__feature-chevron--expanded={isExpanded}
							role="button"
							tabindex="0"
							aria-label={localize('NIMBLE.dicePoolTracker.spendDialog.toggleDescription')}
							onclick={(e) => toggleConsumerExpansion(e, consumer)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									toggleConsumerExpansion(e as unknown as MouseEvent, consumer);
								}
							}}
						>
							<i class="fa-solid fa-chevron-down"></i>
						</span>
					</button>

					{#if isExpanded && consumer.itemDescription}
						<div class="spend-dice-pool-dialog__feature-description">
							{#await enrichDescription(consumer.itemDescription) then enriched}
								{@html enriched}
							{/await}
						</div>
					{/if}

					{#if isSelected}
						<div class="spend-dice-pool-dialog__picker">
							<h4 class="spend-dice-pool-dialog__picker-heading">
								{localize('NIMBLE.dicePoolTracker.spendDialog.pickDice')}
							</h4>
							<div class="spend-dice-pool-dialog__chips">
								{#each pool.faces as value, i (i)}
									{@const chipSelected = selectedIndices.has(i)}
									<button
										type="button"
										class="spend-dice-pool-dialog__die-chip"
										class:spend-dice-pool-dialog__die-chip--selected={chipSelected}
										aria-pressed={chipSelected}
										aria-label={localize('NIMBLE.dicePoolTracker.spendDialog.toggleDie', {
											value: String(value),
										})}
										onclick={() => toggleDie(i)}
									>
										{value}
									</button>
								{/each}
							</div>
							<div class="spend-dice-pool-dialog__summary">
								<span>
									{localize('NIMBLE.dicePoolTracker.spendDialog.summary', {
										count: String(selectedCount),
										total: String(selectedSum),
									})}
								</span>
								{#if livePreviewTotal !== null && selectedCount > 0}
									<span class="spend-dice-pool-dialog__effect-preview">
										{localize('NIMBLE.dicePoolTracker.spendDialog.effectPreview', {
											total: String(livePreviewTotal),
										})}
									</span>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}
</article>

<footer class="nimble-sheet__footer spend-dice-pool-dialog__footer">
	{#if selectedConsumer}
		<button
			type="button"
			class="nimble-button spend-dice-pool-dialog__footer-back"
			data-button-variant="basic"
			onclick={backToFeatures}
		>
			<i class="nimble-button__icon fa-solid fa-arrow-left"></i>
			{localize('NIMBLE.dicePoolTracker.spendDialog.back')}
		</button>
	{/if}
	<button type="button" class="nimble-button" data-button-variant="basic" onclick={onCancel}>
		{localize('NIMBLE.dicePoolTracker.spendDialog.cancel')}
	</button>
	<button
		type="button"
		class="nimble-button spend-dice-pool-dialog__footer-spend"
		data-button-variant="basic"
		disabled={!selectedConsumer || selectedCount < 1}
		onclick={onSpend}
	>
		<i class="nimble-button__icon fa-solid fa-dice"></i>
		{#if selectedCount > 0}
			{localize('NIMBLE.dicePoolTracker.spendDialog.spendWithCount', {
				count: String(selectedCount),
			})}
		{:else}
			{localize('NIMBLE.dicePoolTracker.spendDialog.spend')}
		{/if}
	</button>
</footer>

<style lang="scss">
	[data-button-variant='basic'] {
		--nimble-button-padding: 0.5rem;
	}

	.spend-dice-pool-dialog {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.6rem;

		&__heading {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.5rem;

			h3 {
				margin: 0;
				font-size: 1.1rem;
			}
		}

		&__heading-meta {
			font-size: 0.75rem;
			color: var(--nimble-medium-text-color, var(--nimble-dark-text-color));
		}

		&__empty {
			margin: 0;
			padding: 1rem 0.5rem;
			text-align: center;
			color: var(--nimble-dark-text-color);
			font-style: italic;
		}

		&__features {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
		}

		&__feature {
			background: var(--nimble-card-background-color, var(--nimble-sheet-background));
			border: 1px solid
				var(--nimble-card-border-color, var(--nimble-dice-pool-tracker-panel-border-color));
			border-radius: 4px;
			overflow: hidden;
			transition:
				border-color 0.15s ease,
				background 0.15s ease,
				box-shadow 0.15s ease;

			&:hover {
				border-color: var(--nimble-dice-pool-tracker-expend-hover-color);
			}

			&--selected {
				border-color: var(--nimble-dice-pool-tracker-available-color);
				box-shadow: 0 0 0 1px var(--nimble-dice-pool-tracker-available-color);
			}
		}

		&__feature-row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			padding: 0.4rem 0.5rem;
			background: transparent;
			border: 0;
			text-align: left;
			cursor: pointer;
		}

		&__feature-img {
			flex-shrink: 0;
			width: 1.75rem;
			height: 1.75rem;
			border-radius: 3px;
			object-fit: cover;
			background-color: rgba(0, 0, 0, 0.5);

			&--placeholder {
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--nimble-dark-text-color);
				font-size: 0.85rem;
			}
		}

		&__feature-name {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 600;
		}

		&__feature-chevron {
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			color: var(--nimble-medium-text-color, var(--nimble-dark-text-color));
			border-radius: 3px;
			cursor: pointer;

			&:hover {
				background: var(--nimble-dice-pool-tracker-chip-hover-background);
			}

			i {
				display: inline-block;
				transition: transform 200ms ease-out;
			}

			&--expanded i {
				transform: rotate(180deg);
			}
		}

		&__feature-description {
			padding: 0.5rem 0.75rem;
			border-top: 1px solid
				var(--nimble-card-border-color, var(--nimble-dice-pool-tracker-panel-border-color));
			font-size: 0.85rem;
			line-height: 1.4;

			:global(p) {
				margin-block: 0;

				& + :global(p) {
					margin-block-start: 0.4rem;
				}
			}
		}

		&__picker {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
			padding: 0.5rem 0.6rem 0.6rem;
			border-top: 1px solid
				var(--nimble-card-border-color, var(--nimble-dice-pool-tracker-panel-border-color));
		}

		&__picker-heading {
			margin: 0;
			font-size: 0.7rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--nimble-medium-text-color, var(--nimble-dark-text-color));
		}

		&__chips {
			display: flex;
			flex-wrap: wrap;
			gap: 0.3rem;
		}

		&__die-chip {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 1.75rem;
			height: 1.75rem;
			padding: 0 0.35rem;
			background: var(--nimble-dice-pool-tracker-badge-background);
			border: 2px solid var(--nimble-dice-pool-tracker-available-color);
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.8rem;
			font-weight: 700;
			color: var(--nimble-dice-pool-tracker-available-color);
			transition:
				border-color 0.15s ease,
				color 0.15s ease,
				background 0.15s ease;

			&:hover {
				border-color: var(--nimble-dice-pool-tracker-expend-hover-color);
				color: var(--nimble-dice-pool-tracker-expend-hover-color);
				background: var(--nimble-dice-pool-tracker-chip-hover-background);
			}

			&--selected {
				background: var(--nimble-dice-pool-tracker-available-color);
				color: var(--nimble-sheet-background);

				&:hover {
					background: var(--nimble-dice-pool-tracker-expend-hover-color);
					border-color: var(--nimble-dice-pool-tracker-expend-hover-color);
					color: var(--nimble-sheet-background);
				}
			}
		}

		&__summary {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			gap: 0.5rem;
			padding: 0.3rem 0.4rem;
			background: var(--nimble-dice-pool-tracker-badge-background);
			border-radius: 4px;
			font-size: 0.8rem;
			font-weight: 600;
		}

		&__effect-preview {
			color: var(--nimble-dice-pool-tracker-available-color);
		}

		&__footer {
			display: flex;
			gap: 0.4rem;
			justify-content: flex-end;
			padding: 0.5rem 0.6rem;
		}

		&__footer-back {
			margin-inline-end: auto;
		}
	}
</style>
