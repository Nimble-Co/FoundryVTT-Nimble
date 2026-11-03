<script lang="ts">
	import type { CheckResult } from '#types/checkResult.d.ts';
	import type { CheckCardRollsProps } from '#types/components/CheckCardRolls.d.ts';

	import { setContext, untrack } from 'svelte';
	import localize from '#utils/localize.ts';
	import { CHECK_ROLL_SLOT } from '#utils/reroll/checkCardRollTarget.ts';
	import { rerollJustLanded, rollingRerollOf } from '#utils/reroll/rerollRolling.svelte.ts';
	import { checkResultOfCard } from '#utils/rolls/checkResult.ts';
	import { resultChangesOf, resultTotal } from '#utils/rolls/resultChanges.ts';
	import { getRollModeSummary } from '../../dataPreparationHelpers/getRollModeSummary.js';
	import prepareRollTooltip from '../../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';
	import IncomingReactionPrompts from './IncomingReactionPrompts.svelte';
	import RollSummary from './RollSummary.svelte';

	let { messageDocument, label, note = null }: CheckCardRollsProps = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);

	let system = $derived(
		messageDocument.reactive.system as unknown as {
			actorType: string;
			permissions: number;
			rollMode: number;
			dc?: number | null;
		},
	);
	let rolls = $derived(messageDocument.reactive.rolls);
	let rolling = $derived.by(() => {
		const inAir = rollingRerollOf(messageDocument.id);
		return inAir?.slot === CHECK_ROLL_SLOT ? inAir : null;
	});
	let landed = $derived(rerollJustLanded(messageDocument.id, CHECK_ROLL_SLOT));
	let firstRollResult = $derived.by(() => {
		const result = checkResultOfCard(messageDocument.reactive.type, system, rolls[0]);
		return result ? { result, label: getCheckResultLabel(result, system.dc) } : null;
	});

	/** The words of a check's result: "Failed - DC 14", or "Failed" with no DC. */
	function getCheckResultLabel(result: CheckResult, dc: number | null | undefined): string {
		if (typeof dc !== 'number') return localize(`NIMBLE.chat.checkResult.${result}`);
		return localize(`NIMBLE.chat.checkResult.${result}WithDC`, { dc: String(dc) });
	}
</script>

<!-- A reroll replaces the first roll, so its control and history sit with that roll. -->
{#each rolls as roll, index}
	<RollSummary
		{label}
		subheading={getRollModeSummary(system.rollMode)}
		checkResult={index === 0 ? firstRollResult : null}
		note={index === 0 ? note : null}
		tooltip={prepareRollTooltip(system.actorType, system.permissions, roll)}
		total={index === 0 ? resultTotal(roll.total ?? 0, resultChangesOf(system)) : (roll.total ?? 0)}
		rolling={index === 0 ? rolling : null}
		landed={index === 0 && landed}
	/>

	{#if index === 0}
		<IncomingReactionPrompts place="checkRoll" />
	{/if}
{/each}
