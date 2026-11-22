<script>
	import localize from '#utils/localize.js';
	import { getContext } from 'svelte';
	import { rerollJustLanded, rollingRerollOf } from '#utils/reroll/rerollRolling.svelte.ts';
	import { critDiceLinesOf } from '../../../dice/critDiceLines.js';
	import ChaosButton from './ChaosButton.svelte';
	import prepareRollTooltip from '../../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import { partsText } from '#utils/documents/docLink.ts';
	import RollSummary from './RollSummary.svelte';

	const bonusNotAddedText = (parts) => (parts ? partsText(parts) : null);
	import { primaryDieBonusNotAdded } from './attackOutcomeTags.ts';
	import { damageOutcomeMultiplier, damageRollCaption } from './damageRollCaption.ts';
	import { damageRollDetails } from './damageRollDetails.ts';
	import { documentName } from './incomingReactionText.ts';

	const { damageTypes } = CONFIG.NIMBLE;

	const messageDocument = getContext('messageDocument');
	const { actorType, permissions } = messageDocument.system;
	let primaryDieBonuses = $derived(messageDocument.reactive?.system?.primaryDieBonuses ?? []);
	let rerolls = $derived(messageDocument.reactive?.system?.rerolls ?? []);

	let {
		damageType,
		ignoreArmor = false,
		outcome,
		roll,
		nodeId = null,
		damageMultiplier = 1,
		source = null,
		forTarget = null,
	} = $props();
	let rolling = $derived.by(() => {
		const inAir = nodeId ? rollingRerollOf(messageDocument.id) : null;
		return inAir?.slot === nodeId ? inAir : null;
	});
	let landed = $derived(!!nodeId && rerollJustLanded(messageDocument.id, nodeId));
	let rollOptions = $derived(roll?.options ?? {});
	let label = $derived.by(() => {
		const type = damageTypes[damageType] ?? '';
		const name = forTarget ? (fromUuidSync(forTarget)?.name ?? '') : '';
		return name ? localize('NIMBLE.chat.damageForTarget', { type, name }) : type;
	});
	let details = $derived(
		damageRollDetails({
			rollOptions,
			roll,
			primaryDieBonuses,
			bonusNotAdded: bonusNotAddedText(primaryDieBonusNotAdded(rollOptions, rerolls, documentName)),
			source,
		}),
	);
	let critDiceLines = $derived(critDiceLinesOf(roll?.terms));
	let shownMultiplier = $derived(outcome === 'noDamage' ? 1 : damageMultiplier);
	let multiplier = $derived(damageOutcomeMultiplier(outcome) * shownMultiplier);
	let secondaryInfo = $derived(
		damageRollCaption({
			outcome,
			ignoreArmor,
			rollMode: rollOptions.rollMode,
			damageMultiplier: shownMultiplier,
		}),
	);
</script>

{#if roll?.class}
	<RollSummary
		{label}
		tooltip={prepareRollTooltip(actorType, permissions, Roll.fromData(roll))}
		subheading={secondaryInfo}
		total={Math.ceil(roll.total * multiplier)}
		options={{
			damageType,
			ignoreArmor,
			outcome,
			rollOptions,
			roll,
			isCritical: roll?.isCritical,
			primaryDieBonuses,
		}}
		{details}
		{rolling}
		{landed}
	/>
{:else}
	<RollSummary
		{label}
		tooltip={null}
		subheading={secondaryInfo}
		total={Math.ceil((roll?.total ?? 0) * multiplier)}
		options={{
			damageType,
			ignoreArmor,
			outcome,
			rollOptions,
			roll,
			isCritical: roll?.isCritical,
			primaryDieBonuses,
		}}
		details={source ? details : []}
	/>
{/if}

<ChaosButton />

{#each critDiceLines as line, index (index)}
	<p class="nimble-crit-dice-line" data-tooltip={line.values.join(' + ')}>
		<i class="fa-solid fa-dice" aria-hidden="true"></i>
		{localize('NIMBLE.chat.incomingReactions.critDiceLine', {
			feature: line.label,
			total: String(line.total),
		})}
	</p>
{/each}

<style>
	.nimble-crit-dice-line {
		margin: 0.25rem 0 0;
		font-size: var(--nimble-sm-text);
		font-weight: 600;
	}
</style>
