<script lang="ts">
	import type { NimbleCombat } from '../../../documents/combat/combat.svelte.js';

	async function endCombat(): Promise<void> {
		const combat = game.combat as NimbleCombat | undefined;
		if (!combat) return;

		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: {
				title: 'End Combat?',
			},
			content: '<p>End this combat encounter?</p>',
			yes: {
				label: 'End Combat',
			},
			no: {
				label: 'Continue Combat',
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
		aria-label="Previous Round"
		data-tooltip="Previous Round"
		onclick={rewindRound}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-backward-step"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label="Previous Turn"
		data-tooltip="Previous Turn"
		onclick={rewindTurn}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-caret-left"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label="End Combat"
		data-tooltip="End Combat"
		onclick={endCombat}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-stop"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label="Next Turn"
		data-tooltip="Next Turn"
		onclick={startNextTurn}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-caret-right"></i>
	</button>

	<button
		class="nimble-combat-tracker-controls__button"
		type="button"
		aria-label="Next Round"
		data-tooltip="Next Round"
		onclick={startNextRound}
	>
		<i class="nimble-combat-tracker-controls__button-icon fa-solid fa-forward-step"></i>
	</button>
</div>
