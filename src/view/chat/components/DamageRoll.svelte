<script>
	import { getContext } from 'svelte';
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

	const { damageTypes } = CONFIG.NIMBLE;

	const messageDocument = getContext('messageDocument');
	const { actorType, permissions } = messageDocument.system;

	let { damageType, ignoreArmor = false, outcome, roll } = $props();
	let { options: rollOptions } = $derived(roll);
	let label = $derived(damageTypes[damageType] ?? '');
	let multiplier = $derived(getDamageMultiplier(outcome));
	let secondaryInfo = $derived(getSecondaryInformation(outcome, ignoreArmor, rollOptions).trim());
</script>

<RollSummary
	{label}
	tooltip={prepareRollTooltip(actorType, permissions, Roll.fromData(roll))}
	subheading={secondaryInfo}
	total={Math.ceil(roll.total * multiplier)}
	type="damage"
	options={{ damageType, ignoreArmor, outcome, rollOptions }}
	showRollDetails={rollOptions.primaryDieValue != '0' || rollOptions?.primaryDieModifier != '0'}
/>
