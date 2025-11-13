<script lang="ts">
	function endCombat(): Promise<any> {
		return game.combat?.endCombat();
	}

	function rewindRound(): Promise<any> {
		return game.combat?.previousRound();
	}

	function rewindTurn(): Promise<any> {
		return game.combat?.previousTurn();
	}

	function startNextRound(): Promise<any> {
		return game.combat?.nextRound();
	}

	function startNextTurn(): Promise<any> {
		return game.combat?.nextTurn();
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
