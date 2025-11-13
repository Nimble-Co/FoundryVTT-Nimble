<script>
	function addWeaponProficiency() {
		document.update({
			'system.proficiencies.weapons': [...weaponProficiencies, ''],
		});
	}

	function deleteWeaponProficiency(index) {
		document.update({
			'system.proficiencies.weapons': weaponProficiencies.filter((_, i) => i !== index),
		});
	}

	function updateWeaponProficiency(index, value) {
		document.update({
			'system.proficiencies.weapons': weaponProficiencies.map((weapon, i) =>
				i === index ? value : weapon,
			),
		});
	}

	let { document } = $props();

	let weaponProficiencies = $derived(document.reactive?.system?.proficiencies?.weapons);
</script>

<section class="nimble-sheet__body nimble-sheet__body--proficiency-config">
	<header class="nimble-section-header u-mb-0" data-header-variant="monster-actions">
		<h3 class="nimble-heading" data-heading-variant="section">Weapon Proficiencies</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			type="button"
			data-tooltip="Add Weapon Proficiency"
			aria-label="Add Weapon Proficiency"
			onclick={addWeaponProficiency}
		>
			<i class="fa-solid fa-square-plus"></i>
		</button>
	</header>

	<ul class="nimble-weapon-proficiency-list">
		{#key weaponProficiencies}
			{#each weaponProficiencies as weapon, index}
				<li class="nimble-weapon-proficiency-list__item">
					<input
						type="text"
						value={weapon}
						onchange={(event) => updateWeaponProficiency(index, event.target.value)}
					/>

					<button
						class="nimble-button nimble-weapon-proficiency-list__delete-button"
						data-button-variant="icon"
						data-tooltip="Delete Weapon Proficiency"
						aria-label="Delete Weapon Proficiency"
						onclick={() => deleteWeaponProficiency(index)}
						type="button"
					>
						<i class="fa-solid fa-trash"></i>
					</button>
				</li>
			{:else}
				<li class="nimble-weapon-proficiency-list__item">None</li>
			{/each}
		{/key}
	</ul>
</section>

<style lang="scss">
	.nimble-weapon-proficiency-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: var(--nimble-sm-text);

		&__delete-button {
			position: absolute;
			top: 50%;
			right: 1rem;
			transform: translate(50%, -50%) !important;

			&:hover {
				transform: translate(50%, -50%) scale(1.2) !important;
			}
		}

		&__item {
			position: relative;

			input[type='text'] {
				padding-inline-end: 2rem;
				margin: 0;
			}
		}
	}
</style>
