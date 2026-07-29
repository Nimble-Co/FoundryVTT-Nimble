<script lang="ts">
	import localize from '../../../utils/localize.js';
	import TagGroup from '../../components/TagGroup.svelte';

	function prepareDamageTypeOptions() {
		return Object.entries(damageTypes as Record<string, string>).map(([key, value]) => ({
			label: localize(value),
			value: key,
		}));
	}

	async function toggleDamageTypeEntry(
		field: string,
		current: string[],
		value: string,
	): Promise<void> {
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
			toggleDamageTypeEntry('damageResistances', attributes.damageResistances, String(value))}
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
			toggleDamageTypeEntry('damageImmunities', attributes.damageImmunities, String(value))}
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
			toggleDamageTypeEntry(
				'damageVulnerabilities',
				attributes.damageVulnerabilities,
				String(value),
			)}
	/>

	<small class="nimble-field__hint">
		{localize('NIMBLE.damageDefenses.damageVulnerabilitiesHint')}
	</small>
</div>
