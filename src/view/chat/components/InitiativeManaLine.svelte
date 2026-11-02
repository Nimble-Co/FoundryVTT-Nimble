<script lang="ts">
	import type { InitiativeManaLineProps } from '#types/components/InitiativeManaLine.d.ts';

	import localize from '#utils/localize.js';
	import { canActOnCard, runCardAction } from '#utils/chat/cardActions.js';
	import {
		canRerollInitiativeManaDie,
		initiativeManaTotal,
	} from '#utils/combat/initiativeManaRoll.js';

	let { messageDocument }: InitiativeManaLineProps = $props();

	const initiativeMana = $derived(messageDocument.reactive?.system?.initiativeMana ?? null);
	const canAct = $derived(
		canActOnCard(
			messageDocument as never,
			fromUuidSync((messageDocument.system as { actorUuid?: string }).actorUuid as never) as never,
		),
	);
	const diceText = $derived(
		initiativeMana
			? [
					...(initiativeMana.flat ? [String(initiativeMana.flat)] : []),
					...initiativeMana.dice.map((die) => String(die.value)),
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

{#if initiativeMana}
	<div class="nimble-initiative-mana-line">
		<p class="nimble-initiative-mana-line__total" data-tooltip={diceText}>
			<i class="fa-solid fa-bolt" aria-hidden="true"></i>
			{localize('NIMBLE.chat.initiative.initiativeMana', {
				feature: initiativeMana.feature,
				total: String(initiativeManaTotal(initiativeMana)),
			})}
			{#if initiativeMana.dice.length > 0}
				<span class="nimble-initiative-mana-line__dice">({diceText})</span>
			{/if}
		</p>
		{#each initiativeMana.dice as die (die)}
			{#if die.was !== undefined}
				<p class="nimble-initiative-mana-line__tag">
					{localize('NIMBLE.chat.initiative.initiativeManaRerolled', {
						feature: initiativeMana.rerollFeature,
						was: String(die.was),
						value: String(die.value),
					})}
				</p>
			{/if}
		{/each}
		{#if !initiativeMana.manaGiven && canAct}
			<div class="nimble-initiative-mana-line__rows">
				{#each initiativeMana.dice as die, index (die)}
					{#if canRerollInitiativeManaDie(initiativeMana, die)}
						<button
							type="button"
							disabled={busy}
							onclick={() =>
								run(() =>
									runCardAction(messageDocument as never, { name: 'initiativeManaReroll', index }),
								)}
						>
							{localize('NIMBLE.chat.initiative.initiativeManaRerollOne')}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					disabled={busy}
					onclick={() =>
						run(() => runCardAction(messageDocument as never, { name: 'initiativeManaRegain' }))}
				>
					{localize('NIMBLE.chat.initiative.initiativeManaRegain')}
				</button>
			</div>
		{/if}
	</div>
{/if}

<style lang="scss">
	.nimble-initiative-mana-line {
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
