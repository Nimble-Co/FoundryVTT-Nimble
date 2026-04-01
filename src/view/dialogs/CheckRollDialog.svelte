<script lang="ts">
	import { untrack } from 'svelte';
	import getRollFormula from '../../utils/getRollFormula.js';
	import RollModeConfig from './components/RollModeConfig.svelte';

	const { skillCheckDialog } = CONFIG.NIMBLE;

	type RollDialogType = 'abilityCheck' | 'savingThrow' | 'skillCheck' | 'initiative';

	interface InitiativeDialogActor extends Actor {
		_getInitiativeFormula: (options: Record<string, unknown>) => string;
	}

	interface CheckRollDialogProps {
		actor: InitiativeDialogActor;
		dialog: {
			submitRoll: (results: {
				rollMode: number;
				rollFormula: string;
				visibilityMode: string;
			}) => void;
		};
		type?: RollDialogType;
		abilityKey?: string;
		rollMode?: number;
		saveKey?: string;
		skillKey?: string;
	}

	let { actor, dialog, type = 'abilityCheck', ...data }: CheckRollDialogProps = $props();
	let selectedRollMode = $state(untrack(() => [Math.clamp(Number(data.rollMode ?? 0), -6, 6)]));
	let shouldRollBeHidden = $state(Boolean(game.settings.get('nimble', 'hideRolls')));

	let selectedRollModeValue = $derived(selectedRollMode[0] ?? 0);
	let rollFormula = $derived.by(() => {
		if (type === 'initiative') {
			return actor._getInitiativeFormula({ rollMode: selectedRollModeValue });
		}

		return getRollFormula(actor as Parameters<typeof getRollFormula>[0], {
			...data,
			rollMode: selectedRollModeValue,
			type,
		});
	});
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
				rollMode: selectedRollModeValue,
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
