<script lang="ts">
	import type { CheckRollDialogProps } from '#types/components/CheckRollDialog.d.ts';

	import { untrack } from 'svelte';

	import { SYSTEM_ID } from '#system';
	import Hint from '#view/components/Hint.svelte';
	import { conditionRollModes } from '../../utils/rolls/conditionRollModes.js';
	import getRollFormula from '../../utils/rolls/getRollFormula.js';
	import localize from '../../utils/localize.js';
	import { getSituationalRollModeOptions } from './CheckRollDialog.utils.js';
	import { tickedConditionRollModes } from '../../utils/rolls/appliedConditionRollModes.js';
	import { conditionRollModeOptions } from './components/conditionRollModeOptions.ts';
	import RollModeField from './components/RollModeField.svelte';
	import RollWindow from './components/RollWindow.svelte';
	import { openRollModeTicks } from '#utils/rolls/rollModeTicks.ts';
	import SituationalRollModeList from './components/SituationalRollModeList.svelte';

	const { skillCheckDialog } = CONFIG.NIMBLE;

	let { actor, dialog, type = 'abilityCheck', ...data }: CheckRollDialogProps = $props();

	// Rules are re-instantiated on every data-prep cycle, so the options are resolved
	// once for the life of the dialog rather than tracked reactively.
	const conditions = untrack(() =>
		conditionRollModes({
			kind: 'check',
			roller: actor as Parameters<typeof conditionRollModes>[0]['roller'],
		}),
	);
	const options = [
		...conditionRollModeOptions(conditions),
		...untrack(() =>
			getSituationalRollModeOptions(actor, {
				type,
				abilityKey: data.abilityKey,
				saveKey: data.saveKey,
				skillKey: data.skillKey,
			}),
		),
	];
	const opened = openRollModeTicks(
		untrack(() => Number(data.rollMode ?? 0)),
		options,
	);
	let selectedRollMode = $state(opened.mode);
	let appliedTicks = $state(opened.applied);
	let shouldRollBeHidden = $state(Boolean(game.settings.get(SYSTEM_ID, 'hideRolls')));

	// The window title starts with the name of the actor; the portrait in the head shows who it is.
	const heading = $derived(dialog.title.replace(`${actor.name}: `, ''));

	let rollFormula = $derived.by(() => {
		if (type === 'initiative') {
			return actor._getInitiativeFormula({ rollMode: selectedRollMode });
		}

		return getRollFormula(actor as Parameters<typeof getRollFormula>[0], {
			...data,
			rollMode: selectedRollMode,
			type,
		});
	});
</script>

<RollWindow
	title={heading}
	img={actor.img ?? undefined}
	rollLabel={localize('NIMBLE.rollWindow.roll')}
	oncancel={() => dialog.close()}
	onroll={() =>
		dialog.submitRoll({
			rollMode: selectedRollMode,
			rollFormula,
			visibilityMode: shouldRollBeHidden ? 'blindroll' : 'publicroll',
			conditionRollModes: tickedConditionRollModes(conditions, appliedTicks),
		})}
>
	{#if data.checkHint}
		<Hint hintType="warning" hintIcon="fa-solid fa-circle-exclamation" hintText={data.checkHint} />
	{/if}

	<RollModeField bind:value={selectedRollMode} />

	<SituationalRollModeList {options} bind:value={selectedRollMode} bind:applied={appliedTicks} />

	<div class="frm">{rollFormula}</div>

	{#if game.user?.isGM}
		<label class="check">
			<input type="checkbox" bind:checked={shouldRollBeHidden} />
			<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
			<span>{skillCheckDialog.hideRoll}</span>
		</label>
	{/if}
</RollWindow>
