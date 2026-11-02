<script lang="ts">
	import type { SurgeLineProps } from '#types/components/SurgeLine.d.ts';

	import localize from '#utils/localize.js';
	import { canActOnCard, runCardAction } from '#utils/chat/cardActions.js';
	import { canRerollSurgeDie, surgeTotal } from '#utils/combat/surgeMana.js';

	let { messageDocument }: SurgeLineProps = $props();

	const surge = $derived(messageDocument.reactive?.system?.surge ?? null);
	const canAct = $derived(
		canActOnCard(
			messageDocument as never,
			fromUuidSync((messageDocument.system as { actorUuid?: string }).actorUuid as never) as never,
		),
	);
	const diceText = $derived(
		surge
			? [
					...(surge.flat ? [String(surge.flat)] : []),
					...surge.dice.map((die) => String(die.value)),
				].join(' + ')
			: '',
	);
	let busy = $state(false);

	async function run(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		try {
			await action();
		} finally {
			busy = false;
		}
	}
</script>

{#if surge}
	<div class="nimble-surge-line">
		<p class="nimble-surge-line__total" data-tooltip={diceText}>
			<i class="fa-solid fa-bolt" aria-hidden="true"></i>
			{localize('NIMBLE.chat.initiative.surge', {
				feature: surge.feature,
				total: String(surgeTotal(surge)),
			})}
			{#if surge.dice.length > 0}
				<span class="nimble-surge-line__dice">({diceText})</span>
			{/if}
		</p>
		{#each surge.dice as die (die)}
			{#if die.was !== undefined}
				<p class="nimble-surge-line__tag">
					{localize('NIMBLE.chat.initiative.surgeRerolled', {
						feature: surge.rerollFeature,
						was: String(die.was),
						value: String(die.value),
					})}
				</p>
			{/if}
		{/each}
		{#if !surge.manaGiven && canAct}
			<div class="nimble-surge-line__rows">
				{#each surge.dice as die, index (die)}
					{#if canRerollSurgeDie(surge, die)}
						<button
							type="button"
							disabled={busy}
							onclick={() =>
								run(() => runCardAction(messageDocument as never, { name: 'surgeReroll', index }))}
						>
							{localize('NIMBLE.chat.initiative.surgeRerollOne')}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					disabled={busy}
					onclick={() =>
						run(() => runCardAction(messageDocument as never, { name: 'surgeRegain' }))}
				>
					{localize('NIMBLE.chat.initiative.surgeRegain')}
				</button>
			</div>
		{/if}
	</div>
{/if}

<style lang="scss">
	.nimble-surge-line {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.25rem;
		font-size: var(--nimble-sm-text);

		&__total {
			margin: 0;
			font-weight: 600;
		}

		&__dice {
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}

		&__tag {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__rows {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}
	}
</style>
