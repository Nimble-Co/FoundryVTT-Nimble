<script>
	import { getContext } from 'svelte';

	import RangeConfig from '../components/RangeConfig.svelte';
	import ReachConfig from '../components/ReachConfig.svelte';
	import TagGroup from '../../components/TagGroup.svelte';

	let item = getContext('document');
	let sheet = getContext('application');

	const { spellProperties, spellSchoolIcons, spellSchools, spellTiers } = CONFIG.NIMBLE;
	const { toggleSpellPropertyOption, toggleSpellSchoolOption, toggleSpellTierOption } = sheet;

	const spellTierOptions = Object.entries(spellTiers).map(([key, label]) => ({
		label,
		value: Number.parseInt(key, 10),
	}));

	const spellSchoolOptions = Object.entries(spellSchools).map(([key, label]) => ({
		label,
		value: key,
		icon: spellSchoolIcons[key],
	}));

	const spellPropertyOptions = Object.entries(spellProperties)
		.map(([key, property]) => ({ label: property, value: key }))
		.sort((a, b) => a.label.localeCompare(b.label));
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Identifier</h3>
		</header>

		<input
			type="text"
			value={item.reactive.identifier || ''}
			onchange={({ target }) => item.update({ 'system.identifier': target.value })}
		/>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Spell Properties</h3>
		</header>

		<TagGroup
			options={spellPropertyOptions}
			selectedOptions={item.reactive.system.properties.selected}
			toggleOption={toggleSpellPropertyOption.bind(sheet)}
		/>
	</section>

	{#if item.reactive?.system.properties.selected.includes('range')}
		<RangeConfig {item} />
	{/if}

	{#if item.reactive?.system.properties.selected.includes('reach')}
		<ReachConfig {item} />
	{/if}

	{#if !item.reactive.system.properties.selected.includes('utilitySpell')}
		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Spell Tier</h3>
			</header>

			<TagGroup
				grid={true}
				options={spellTierOptions}
				selectedOptions={[item.reactive.system.tier ?? 0]}
				toggleOption={toggleSpellTierOption.bind(sheet)}
				--nimble-tag-group-grid-columns="repeat(4, 1fr)"
			/>
		</section>
	{/if}

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Spell School</h3>
		</header>

		<TagGroup
			grid={true}
			options={spellSchoolOptions}
			selectedOptions={[item.reactive.system.school ?? 'fire']}
			toggleOption={toggleSpellSchoolOption.bind(sheet)}
			--nimble-tag-group-grid-columns="repeat(3, 1fr)"
		/>
	</section>
</section>
