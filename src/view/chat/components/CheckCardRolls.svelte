<script lang="ts">
	import type { CheckCardRollsProps } from '#types/components/CheckCardRolls.d.ts';

	import { setContext, untrack } from 'svelte';
	import { CHECK_ROLL_SLOT } from '#utils/reroll/checkCardRollTarget.ts';
	import { rerollJustLanded, rollingRerollOf } from '#utils/reroll/rerollRolling.svelte.ts';
	import { getRollModeSummary } from '../../dataPreparationHelpers/getRollModeSummary.js';
	import prepareRollTooltip from '../../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';
	import IncomingReactionPrompts from './IncomingReactionPrompts.svelte';
	import RollSummary from './RollSummary.svelte';

	let { messageDocument, label }: CheckCardRollsProps = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);

	let system = $derived(
		messageDocument.reactive.system as unknown as {
			actorType: string;
			permissions: number;
			rollMode: number;
		},
	);
	let rolls = $derived(messageDocument.reactive.rolls);
	let rolling = $derived.by(() => {
		const inAir = rollingRerollOf(messageDocument.id);
		return inAir?.slot === CHECK_ROLL_SLOT ? inAir : null;
	});
	let landed = $derived(rerollJustLanded(messageDocument.id, CHECK_ROLL_SLOT));
</script>

{#snippet rerollButton()}
	<IncomingReactionPrompts place="rollButton" />
{/snippet}

<!-- A reroll replaces the first roll, so its button and history sit with that roll. -->
{#each rolls as roll, index}
	<RollSummary
		{label}
		subheading={getRollModeSummary(system.rollMode)}
		tooltip={prepareRollTooltip(system.actorType, system.permissions, roll)}
		total={roll.total ?? 0}
		action={index === 0 ? rerollButton : undefined}
		rolling={index === 0 ? rolling : null}
		landed={index === 0 && landed}
	/>

	{#if index === 0}
		<IncomingReactionPrompts place="rollHistory" />
	{/if}
{/each}
