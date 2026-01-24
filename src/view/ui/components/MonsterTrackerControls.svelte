<script lang="ts">
	import BaseCombatant from './BaseCombatant.svelte';

	async function updateNonPcCombatantAction(event) {
		event.preventDefault();
		event.stopPropagation();

		const currentActions = combatant.reactive?.system?.actions?.base?.current ?? 0;
		const newValue = currentActions === 1 ? 0 : 1;

		console.log(combatant);
		await combatant.update({
			'system.actions.base.current': newValue,
		});
	}

	let { active, combatant } = $props();
	let isObserver = combatant.actor?.testUserPermission(game.user, 'OBSERVER');
	let isGM = combatant.actor?.testUserPermission(game.user, 'GM');
</script>

<BaseCombatant {active} {combatant}>
	{#if combatant.type !== 'character' && combatant.reactive.initiative !== null && (isGM || isObserver)}
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
		</div>
	{/if}
</BaseCombatant>
