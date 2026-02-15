<script>
	import BaseCombatant from './BaseCombatant.svelte';
	import { isCombatantDead } from '../../../utils/isCombatantDead.js';

	async function rollInitiative(event, combatantId) {
		event.preventDefault();
		event.stopPropagation();

		game.combat?.rollInitiative([combatantId]);
	}

	async function updateCombatantActionCount(event, actionCount) {
		event.preventDefault();
		event.stopPropagation();

		const currentActionsRemaining = foundry.utils.getProperty(
			combatant,
			'system.actions.base.current',
		);

		let updatedActionCount = actionCount;

		if (actionCount === currentActionsRemaining) {
			updatedActionCount = currentActionsRemaining - 1;
		}

		await combatant.update({
			'system.actions.base.current': updatedActionCount,
		});
	}

	async function endTurn(event) {
		event.preventDefault();
		event.stopPropagation();

		if (!active || (!isOwner && !game.user.isGM)) return;

		const parentCombat = combatant.parent;
		if (!parentCombat) return;

		try {
			await parentCombat.nextTurn();
		} catch (_error) {
			ui.notifications?.warn('You do not have permission to end turns.');
		}
	}

	let { active, combatant } = $props();
	let isOwner = combatant.actor?.testUserPermission(game.user, 'OWNER');
	let isObserver = combatant.actor?.testUserPermission(game.user, 'OBSERVER');
	let isDead = $derived(isCombatantDead(combatant));
</script>

<BaseCombatant {active} {combatant}>
	{#if !isDead && combatant.reactive.initiative === null}
		{#if isOwner}
			<div class="nimble-combatant-actions">
				<button
					class="nimble-combatant-actions__initiative-button"
					type="button"
					aria-label="Roll Initiative"
					data-tooltip="Roll Initiative"
					onclick={(event) => {
						rollInitiative(event, combatant._id);
					}}
				>
					<i class="nimble-combatant-actions__initiative-icon fa-solid fa-dice-d20"></i>
				</button>
			</div>
		{/if}
	{:else if !isDead && isObserver && combatant.type === 'character'}
		<div
			class="nimble-combatant-actions"
			class:nimble-combatant-actions--disabled={!isOwner && !game.user.isGM}
		>
			{#each { length: combatant.system.actions.base.max }, index}
				<button
					class="nimble-combatant-actions__pip-button"
					type="button"
					aria-label="Toggle Action"
					onclick={(event) => updateCombatantActionCount(event, index + 1)}
				>
					{#if combatant?.reactive?.system?.actions?.base?.current <= index}
						<i class="nimble-combatant-actions__pip fa-regular fa-circle"></i>
					{:else}
						<i class="nimble-combatant-actions__pip fa-solid fa-circle"></i>
					{/if}
				</button>
			{/each}

			{#if active && (isOwner || game.user.isGM)}
				<button
					class="nimble-combatant-actions__end-turn-button"
					type="button"
					aria-label="End Turn"
					data-tooltip="End Turn"
					onclick={endTurn}
				>
					End Turn
				</button>
			{/if}
		</div>
	{/if}
</BaseCombatant>
