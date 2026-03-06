<script>
	import { untrack } from 'svelte';
	import RollModeConfig from './components/RollModeConfig.svelte';

	import getRollFormula from '../../utils/getRollFormula.js';
	const { skillCheckDialog } = CONFIG.NIMBLE;

	function clampRollMode(value) {
		return Math.max(-6, Math.min(6, Number(value) || 0));
	}

	let { actor, dialog, ...data } = $props();
	let selectedRollMode = $state(untrack(() => clampRollMode(data.rollMode)));
	let shouldRollBeHidden = $state(!!game.settings.get('nimble', 'hideRolls'));

	let rollFormula = $derived(
		getRollFormula(actor, {
			...data,
			rollMode: selectedRollMode,
		}),
	);
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
	<RollModeConfig bind:selectedRollMode />
	{#if game.user?.isGM}
		<div class="nimble-roll-modifiers-container">
			<label>
				{skillCheckDialog.hideRoll}
				<input type="checkbox" bind:checked={shouldRollBeHidden} class="modifier-item__checkbox" />
			</label>
		</div>
	{/if}
	<div class="nimble-roll-formula">{rollFormula}</div>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		onclick={() =>
			dialog.submitRoll({
				rollMode: selectedRollMode[0],
				rollFormula,
				visibilityMode: shouldRollBeHidden ? 'blindroll' : 'publicroll',
			})}
	>
		<i class="nimble-button__icon fa-solid fa-dice-d20"></i>
		Roll
	</button>
</footer>

<style lang="scss">
	[data-button-variant='basic'] {
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}
</style>
