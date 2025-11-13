<script>
	function prepareArmorOptions() {
		return Object.entries(armorTypesPlural).sort((a, b) => a[1].localeCompare(b[1]));
	}

	function toggleArmorProficiency(armor) {
		const _armorProficiencies = new Set(armorProficiencies);

		if (_armorProficiencies.has(armor)) _armorProficiencies.delete(armor);
		else _armorProficiencies.add(armor);

		document.update({
			'system.proficiencies.armor': _armorProficiencies,
		});
	}

	let { document } = $props();

	let armorProficiencies = $derived(document.reactive?.system?.proficiencies?.armor);

	const { armorTypesPlural } = CONFIG.NIMBLE;
	const armorOptions = prepareArmorOptions();
</script>

<section class="nimble-sheet__body nimble-sheet__body--proficiency-config">
	<header>
		<h3 class="nimble-heading" data-heading-variant="section">Armor Proficiencies</h3>
	</header>

	{#each armorOptions as [key, label]}
		<label class="nimble-field s-v5veGpsAo6Di">
			<input
				type="checkbox"
				checked={armorProficiencies.has(key)}
				onclick={() => toggleArmorProficiency(key)}
			/>

			<span class="nimble-field__label s-v5veGpsAo6Di">{label}</span>
		</label>
	{/each}
</section>
