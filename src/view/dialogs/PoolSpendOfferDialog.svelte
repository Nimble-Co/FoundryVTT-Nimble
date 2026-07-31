<script lang="ts">
	import { createSubscriber } from 'svelte/reactivity';
	import type PoolSpendOfferDialog from '#documents/dialogs/PoolSpendOfferDialog.svelte.ts';
	import { systemHookName } from '#system';
	import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
	import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
	import { getDieFaceIcon } from '#utils/dicePool/dieFaceIcons.js';
	import { substituteSpendFormula } from '#utils/dicePool/substituteSpendFormula.js';
	import localize from '#utils/localize.js';

	interface Props {
		actor: Actor;
		poolId: string;
		ruleId: string;
		itemId: string | null;
		dialog: PoolSpendOfferDialog;
	}

	let { actor, poolId, ruleId, itemId, dialog }: Props = $props();

	// The pool can move while the picker is open (a refill trigger, another
	// feature spending a die). Track it rather than snapshotting, so what the
	// player sees is what the executor will validate against.
	const POOL_HOOK_NAMES = [
		systemHookName('dicePool.changed'),
		systemHookName('dicePool.refilled'),
		'updateActor',
		'updateItem',
	] as const;

	const subscribePool = createSubscriber((update) => {
		const hooksApi = Hooks as unknown as {
			on: (hook: string, listener: () => void) => number;
			off: (hook: string, id: number) => void;
		};
		const ids = POOL_HOOK_NAMES.map((name) => ({ name, id: hooksApi.on(name, update) }));
		return () => {
			for (const { name, id } of ids) hooksApi.off(name, id);
		};
	});

	let pool = $derived.by(() => {
		subscribePool();
		return getDicePools(actor).find((p) => p.id === poolId) ?? null;
	});
	// Rule ids are only unique within an item, so the owning item disambiguates
	// here the same way it does for the card button and the GM-side executor.
	// Without it the preview could describe a different consumer than the one
	// the executor resolves.
	let consumer = $derived(
		pool
			? (getDicePoolConsumers(actor, pool, { includeCardOffers: true }).find(
					(c) => c.ruleId === ruleId && (!itemId || c.itemId === itemId),
				) ?? null)
			: null,
	);

	let selectedIndices = $state(new Set<number>());
	let previewTotal = $state<number | null>(null);

	let faces = $derived(pool?.faces ?? []);
	let selectedFaces = $derived(faces.filter((_, index) => selectedIndices.has(index)));
	let selectedSum = $derived(selectedFaces.reduce((sum, face) => sum + face, 0));

	$effect(() => {
		const size = faces.length;
		const next = new Set([...selectedIndices].filter((index) => index < size));
		if (next.size !== selectedIndices.size) selectedIndices = next;
	});

	function toggleDie(index: number) {
		const next = new Set(selectedIndices);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		selectedIndices = next;
	}

	async function evaluatePreview(count: number, sum: number): Promise<number | null> {
		if (!consumer?.effectFormula || count < 1) return null;
		try {
			const roll = new Roll(
				substituteSpendFormula(consumer.effectFormula, count, sum),
				(actor as unknown as { getRollData: () => object }).getRollData(),
			);
			await roll.evaluate({ allowInteractive: false } as Parameters<Roll['evaluate']>[0]);
			return roll.total ?? null;
		} catch {
			return null;
		}
	}

	$effect(() => {
		const count = selectedFaces.length;
		const sum = selectedSum;
		if (count < 1) {
			previewTotal = null;
			return;
		}
		let cancelled = false;
		void evaluatePreview(count, sum).then((total) => {
			if (!cancelled) previewTotal = total;
		});
		return () => {
			cancelled = true;
		};
	});

	function onConfirm() {
		if (selectedIndices.size < 1) return;
		const faceIndices = [...selectedIndices];
		// Report the faces the player is looking at, so the executor can tell a
		// stale pick from a live one rather than trusting bare indices.
		void dialog.submitSpend({
			poolId,
			faceIndices,
			expectedFaces: faceIndices.map((index) => faces[index]),
		});
	}
</script>

<div class="nimble-pool-spend-offer">
	{#if !pool || !consumer}
		<p class="nimble-pool-spend-offer__empty">
			{localize('NIMBLE.chat.incomingReactions.poolSpendUnavailable')}
		</p>
	{:else if faces.length < 1}
		<p class="nimble-pool-spend-offer__empty">
			{localize('NIMBLE.chat.incomingReactions.poolSpendEmpty', { label: pool.label })}
		</p>
	{:else}
		<p class="nimble-pool-spend-offer__hint">
			{localize('NIMBLE.chat.incomingReactions.poolSpendHint', { label: consumer.itemName })}
		</p>

		<div class="nimble-pool-spend-offer__row">
			<span class="nimble-pool-spend-offer__label">
				<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
				{pool.label}
			</span>
			<div class="nimble-pool-spend-offer__dice">
				{#each faces as face, faceIndex (faceIndex)}
					<button
						type="button"
						class="nimble-pool-spend-offer__die"
						class:nimble-pool-spend-offer__die--selected={selectedIndices.has(faceIndex)}
						aria-pressed={selectedIndices.has(faceIndex)}
						onclick={() => toggleDie(faceIndex)}
					>
						{face}
					</button>
				{/each}
			</div>
		</div>

		{#if previewTotal !== null}
			<p class="nimble-pool-spend-offer__preview">
				{localize('NIMBLE.chat.incomingReactions.poolSpendPreview', {
					amount: String(previewTotal),
				})}
			</p>
		{/if}

		<button
			class="nimble-button nimble-pool-spend-offer__confirm"
			type="button"
			disabled={selectedIndices.size < 1}
			onclick={onConfirm}
		>
			{localize('NIMBLE.chat.incomingReactions.poolSpendConfirm')}
		</button>
	{/if}
</div>

<style lang="scss">
	.nimble-pool-spend-offer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;

		&__hint,
		&__empty {
			margin: 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
		}

		&__label {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
		}

		&__dice {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		&__die {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			font-weight: 700;
			background: var(--nimble-pool-node-face-background);
			border: 1px solid var(--nimble-pool-node-face-border-color);
			border-radius: 4px;
			color: var(--nimble-pool-node-face-text-color);
			cursor: pointer;

			&--selected {
				border-width: 2px;
				border-color: var(--nimble-primary-color, currentColor);
			}
		}

		&__preview {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
		}

		&__confirm {
			width: 100%;
			height: 2rem;
		}
	}
</style>
