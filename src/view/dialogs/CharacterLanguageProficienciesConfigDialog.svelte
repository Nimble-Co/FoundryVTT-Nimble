<script>
	function prepareLanguageOptions() {
		return Object.entries(languages).sort((a, b) => a[1].localeCompare(b[1]));
	}

	function toggleLanguageProficiency(language) {
		const languageProficiencies = new Set(knownLanguages);

		if (languageProficiencies.has(language)) languageProficiencies.delete(language);
		else languageProficiencies.add(language);

		document.update({
			'system.proficiencies.languages': languageProficiencies,
		});
	}

	const { languages } = CONFIG.NIMBLE;
	const languageOptions = prepareLanguageOptions();

	let { document } = $props();

	let knownLanguages = $derived(document.reactive?.system?.proficiencies?.languages);
</script>

<section class="nimble-sheet__body nimble-sheet__body--proficiency-config">
	<header>
		<h3 class="nimble-heading" data-heading-variant="section">Language Proficiencies</h3>
	</header>

	{#each languageOptions as [key, label]}
		<label class="nimble-field">
			<input
				type="checkbox"
				checked={knownLanguages.has(key)}
				onclick={() => toggleLanguageProficiency(key)}
			/>

			<span class="nimble-field__label">{label}</span>
		</label>
	{/each}
</section>
