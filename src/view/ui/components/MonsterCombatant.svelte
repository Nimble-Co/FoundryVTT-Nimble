<script lang="ts">
	import BaseCombatant from './BaseCombatant.svelte';
	import { isCombatantDead } from '../../../utils/isCombatantDead.js';

	async function updateNonPcCombatantAction(event) {
		event.preventDefault();
		event.stopPropagation();

		const currentActions = combatant.reactive?.system?.actions?.base?.current ?? 0;
		const newValue = currentActions === 1 ? 0 : 1;

		await combatant.update({
			'system.actions.base.current': newValue,
		});
	}

	async function endTurn(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (!active || !game.user.isGM) return;

		const parentCombat = combatant.parent;
		if (!parentCombat) return;

		try {
			await parentCombat.nextTurn();
		} catch (_error) {
			ui.notifications?.warn('You do not have permission to end turns.');
		}
	}

	let { active, combatant } = $props();
	let isObserver = combatant.actor?.testUserPermission(game.user, 'OBSERVER');
	let isDead = $derived(isCombatantDead(combatant));
</script>

<BaseCombatant {active} {combatant}>
	{#if !isDead && combatant.type !== 'character' && combatant.reactive.initiative !== null && (game.user.isGM || isObserver)}
		<div class="nimble-combatant-actions">
			{#each { length: combatant.system.actions.base.max }, index}
				<button
					class="nimble-combatant-actions__pip-button"
					type="button"
					aria-label="Toggle Action"
					onclick={(event) => updateNonPcCombatantAction(event)}
					disabled={!game.user.isGM}
				>
					{#if combatant?.reactive?.system?.actions?.base?.current <= index}
						<i class="nimble-combatant-actions__pip fa-regular fa-circle"></i>
					{:else}
						<i class="nimble-combatant-actions__pip fa-solid fa-circle"></i>
					{/if}
				</button>
			{/each}

			{#if active && game.user.isGM}
				<button
					class="nimble-combatant-actions__end-turn-button"
					type="button"
					aria-label="End Turn"
					onclick={endTurn}
				>
					End Turn
				</button>
			{/if}
		</div>
	{/if}
</BaseCombatant>
