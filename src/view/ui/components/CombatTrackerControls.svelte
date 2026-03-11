<script lang="ts">
	import type { NimbleCombat } from '../../../documents/combat/combat.svelte.js';
	import localize from '../../../utils/localize.js';

	async function endCombat(): Promise<void> {
		const combat = game.combat as NimbleCombat | undefined;
		if (!combat) return;

		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: {
				title: localize('NIMBLE.combatControls.endCombatTitle'),
			},
			content: `<p>${localize('NIMBLE.combatControls.endCombatContent')}</p>`,
			yes: {
				label: localize('NIMBLE.combatControls.endCombat'),
			},
			no: {
				label: localize('NIMBLE.combatControls.continueCombat'),
			},
			rejectClose: false,
			modal: true,
		});

		if (confirmed !== true) return;

		// Re-resolve the current combat after modal interaction to avoid deleting
		// a stale reference if combat state changed while the dialog was open.
		const currentCombat = game.combat as NimbleCombat | undefined;
		if (!currentCombat || currentCombat.id !== combat.id) return;

		await currentCombat.delete();
	}

	function rewindRound(): Promise<NimbleCombat> | undefined {
		return (game.combat as NimbleCombat | undefined)?.previousRound();
	}

	function rewindTurn(): Promise<NimbleCombat> | undefined {
		return (game.combat as NimbleCombat | undefined)?.previousTurn();
	}

	function startNextRound(): Promise<NimbleCombat> | undefined {
		return (game.combat as NimbleCombat | undefined)?.nextRound();
	}

	function startNextTurn(): Promise<NimbleCombat> | undefined {
		return (game.combat as NimbleCombat | undefined)?.nextTurn();
	}
</script>

<div class="nimble-combat-tracker-controls">
	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label={localize('NIMBLE.combatControls.previousRound')}
		data-tooltip="NIMBLE.combatControls.previousRound"
		onclick={rewindRound}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-backward-step"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label={localize('NIMBLE.combatControls.previousTurn')}
		data-tooltip="NIMBLE.combatControls.previousTurn"
		onclick={rewindTurn}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-caret-left"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label={localize('NIMBLE.combatControls.endCombat')}
		data-tooltip="NIMBLE.combatControls.endCombat"
		onclick={endCombat}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-stop"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label={localize('NIMBLE.combatControls.nextTurn')}
		data-tooltip="NIMBLE.combatControls.nextTurn"
		onclick={startNextTurn}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-caret-right"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label={localize('NIMBLE.combatControls.nextRound')}
		data-tooltip="NIMBLE.combatControls.nextRound"
		onclick={startNextRound}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-forward-step"></i>
	</button>
</div>
