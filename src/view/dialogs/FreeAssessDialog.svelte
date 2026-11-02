<!--
@component
Assess for free and with advantage: the option and the skill.
-->
<script lang="ts">
	import type { FreeAssessDialogProps } from '#types/components/FreeAssessDialog.d.ts';
	import { untrack } from 'svelte';
	import { assessOptions } from '#utils/assessOptions.js';
	import localize from '#utils/localize.js';
	import RollWindow from './components/RollWindow.svelte';

	let { dialog, roundUsed, spendLine }: FreeAssessDialogProps = $props();

	const skills = Object.entries(CONFIG.NIMBLE.skills as Record<string, string>).sort(
		([, a], [, b]) => a.localeCompare(b),
	);
	let option = $state(assessOptions[0]?.id ?? '');
	let skill = $state(skills[0]?.[0] ?? '');
	const usedLine = untrack(() => roundUsed);

	function onConfirm() {
		dialog.submitActivation({ optionId: option, skillKey: skill });
	}
</script>

<RollWindow
	title={localize('NIMBLE.ui.heroicActions.assess.header')}
	icon="fa-solid fa-magnifying-glass"
	rollLabel={localize('NIMBLE.rollWindow.roll')}
	oncancel={() => dialog.close()}
	onroll={onConfirm}
>
	{#if usedLine}<p class="note">{localize('NIMBLE.demandControl.usedThisRound')}</p>{/if}
	<p class="note">{spendLine}</p>
	<div class="fld">
		<span class="lb">{localize('NIMBLE.ui.heroicActions.assess.header')}</span>
		<select bind:value={option} aria-label={localize('NIMBLE.ui.heroicActions.assess.header')}>
			{#each assessOptions as each (each.id)}
				<option value={each.id}>{localize(each.titleKey)}</option>
			{/each}
		</select>
	</div>
	<div class="fld">
		<span class="lb">{localize('NIMBLE.ui.heroicActions.assess.selectSkillPlaceholder')}</span>
		<select
			bind:value={skill}
			aria-label={localize('NIMBLE.ui.heroicActions.assess.selectSkillPlaceholder')}
		>
			{#each skills as [key, name] (key)}
				<option value={key}>{name}</option>
			{/each}
		</select>
	</div>
</RollWindow>

<style>
	.note {
		margin: 0;
		font-size: 0.781rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
</style>
