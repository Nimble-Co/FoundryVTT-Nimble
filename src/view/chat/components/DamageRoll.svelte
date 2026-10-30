<script>
	import { getContext } from 'svelte';
	import { rerollJustLanded, rollingRerollOf } from '#utils/reroll/rerollRolling.svelte.ts';
	import prepareRollTooltip from '../../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import RollSummary from './RollSummary.svelte';

	function getDamageMultiplier(damageOutcome = 'fullDamage') {
		if (damageOutcome === 'fullDamage') return 1;
		if (damageOutcome === 'halfDamage') return 0.5;
		if (damageOutcome === 'noDamage') return 1; // Show actual roll value for misses
		return 0;
	}

	function getRollModeSummary(rollMode) {
		if (rollMode >= 1) return `Advantage x ${rollMode}`;
		if (rollMode <= -1) return `Disadvantage x ${Math.abs(rollMode)}`;
		return '';
	}

	function getSecondaryInformation(outcome, ignoreArmor, rollOptions) {
		const rollModeSummary = getRollModeSummary(rollOptions.rollMode);

		// For misses, don't include "No Damage" - the card header shows "Miss"
		if (outcome === 'noDamage') {
			if (ignoreArmor) return `${rollModeSummary} (Ignores Armor)`.trim();
			return rollModeSummary;
		}
		if (outcome === 'fullDamage' && ignoreArmor) return `${rollModeSummary} (Ignores Armor)`;
		if (outcome === 'halfDamage') {
			if (ignoreArmor) return `${rollModeSummary} (Half Damage, Ignores Armor)`;
			return `${rollModeSummary} (Half Damage)`;
		}

		return rollModeSummary;
	}

	// A roll written onto the card after the fact serializes `options: {}`, so a
	// present-and-non-zero test is the only one that keeps the details block from
	// drawing two empty labels.
	function hasPrimaryDieDetails(rollOptions) {
		if (rollOptions?.canCrit === false && rollOptions?.canMiss === false) return false;

		const modifier = rollOptions?.primaryDieBonusOff ? null : rollOptions?.primaryDieModifier;
		return [rollOptions?.primaryDieValue, modifier].some((value) => value != null && value != 0);
	}

	const { damageTypes } = CONFIG.NIMBLE;

	const messageDocument = getContext('messageDocument');
	const { actorType, permissions } = messageDocument.system;
	let primaryDieBonuses = $derived(messageDocument.reactive?.system?.primaryDieBonuses ?? []);

	let { damageType, ignoreArmor = false, outcome, roll, nodeId = null } = $props();
	let rolling = $derived.by(() => {
		const inAir = nodeId ? rollingRerollOf(messageDocument.id) : null;
		return inAir?.slot === nodeId ? inAir : null;
	});
	let landed = $derived(!!nodeId && rerollJustLanded(messageDocument.id, nodeId));
	let rollOptions = $derived(roll?.options ?? {});
	let label = $derived(damageTypes[damageType] ?? '');
	let multiplier = $derived(getDamageMultiplier(outcome));
	let secondaryInfo = $derived(getSecondaryInformation(outcome, ignoreArmor, rollOptions).trim());
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
		showRollDetails={hasPrimaryDieDetails(rollOptions)}
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
		showRollDetails={false}
	/>
{/if}
