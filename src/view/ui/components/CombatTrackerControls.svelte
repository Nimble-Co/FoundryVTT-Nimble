<script lang="ts">
	import type { NimbleCombat } from '../../../documents/combat/combat.svelte';

	function endCombat(): Promise<NimbleCombat> | undefined {
		return (game.combat as NimbleCombat | undefined)?.endCombat();
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
