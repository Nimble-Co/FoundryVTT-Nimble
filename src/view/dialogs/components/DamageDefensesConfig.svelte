<script>
	import localize from '../../../utils/localize.js';
	import TagGroup from '../../components/TagGroup.svelte';

	function prepareDamageTypeOptions() {
		return Object.entries(damageTypes).map(([key, value]) => ({
			label: localize(value),
			value: key,
		}));
	}

	async function toggleDamageTypeEntry(field, current, value) {
		const next = current.includes(value)
			? current.filter((entry) => entry !== value)
			: [...current, value];

		await actor.update({ [`system.attributes.${field}`]: next });
	}

	const { damageTypes } = CONFIG.NIMBLE;

	let { actor } = $props();

	let attributes = $derived(actor.reactive.system.attributes);
</script>

<div class="nimble-field" data-field-variant="stacked">
	<h3 class="nimble-heading" data-heading-variant="field">
		{localize('NIMBLE.damageDefenses.damageResistances')}
	</h3>

	<TagGroup
		options={prepareDamageTypeOptions()}
		selectedOptions={attributes.damageResistances}
		toggleOption={(value) =>
			toggleDamageTypeEntry('damageResistances', attributes.damageResistances, value)}
	/>
</div>

<div class="nimble-field" data-field-variant="stacked">
	<h3 class="nimble-heading" data-heading-variant="field">
		{localize('NIMBLE.damageDefenses.damageImmunities')}
	</h3>

	<TagGroup
		options={prepareDamageTypeOptions()}
		selectedOptions={attributes.damageImmunities}
		toggleOption={(value) =>
			toggleDamageTypeEntry('damageImmunities', attributes.damageImmunities, value)}
	/>
</div>

<div class="nimble-field" data-field-variant="stacked">
	<h3 class="nimble-heading" data-heading-variant="field">
		{localize('NIMBLE.damageDefenses.damageVulnerabilities')}
	</h3>

	<TagGroup
		options={prepareDamageTypeOptions()}
		selectedOptions={attributes.damageVulnerabilities}
		toggleOption={(value) =>
			toggleDamageTypeEntry('damageVulnerabilities', attributes.damageVulnerabilities, value)}
	/>

	<small class="nimble-field__hint">
		{localize('NIMBLE.damageDefenses.damageVulnerabilitiesHint')}
	</small>
</div>
