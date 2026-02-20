<script>
	import { getContext } from 'svelte';

	import RangeConfig from '../components/RangeConfig.svelte';
	import ReachConfig from '../components/ReachConfig.svelte';
	import ScalingConfig from '../components/ScalingConfig.svelte';
	import TagGroup from '../../components/TagGroup.svelte';
	import overrideTextAreaBehavior from '../../../utils/overrideTextAreaBehavior.js';

	let item = getContext('document');
	let sheet = getContext('application');

	const { spellProperties, spellSchoolIcons, spellSchools, spellTiers } = CONFIG.NIMBLE;
	const { toggleSpellPropertyOption, toggleSpellSchoolOption, toggleSpellTierOption } = sheet;

	let showJsonEditor = $state(false);
	let jsonError = $state('');
	let systemJson = $derived(JSON.stringify(item.reactive.system, null, 2));

	async function updateFromJson(event) {
		const text = event.target.value;
		try {
			const parsed = JSON.parse(text);
			jsonError = '';
			await item.update({ system: parsed });
		} catch {
			jsonError = 'Invalid JSON';
		}
	}

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
	<div class="nimble-config-toolbar">
		<button
			class="nimble-button nimble-config-toolbar__toggle"
			data-button-variant="icon"
			type="button"
			aria-label={showJsonEditor ? 'Visual Editor' : 'JSON Editor'}
			data-tooltip={showJsonEditor ? 'Switch to Visual Editor' : 'Switch to JSON Editor'}
			data-tooltip-direction="LEFT"
			onclick={() => (showJsonEditor = !showJsonEditor)}
		>
			<i class="fa-solid {showJsonEditor ? 'fa-sliders' : 'fa-code'}"></i>
		</button>
	</div>

	{#if showJsonEditor}
		<section class="nimble-config-json">
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Spell Data (JSON)</h3>
			</header>

			<textarea
				class="nimble-code-block__text-area"
				value={systemJson}
				rows="24"
				autocapitalize="off"
				autocomplete="off"
				spellcheck={false}
				wrap="soft"
				onchange={updateFromJson}
				onkeydown={overrideTextAreaBehavior}
			></textarea>
			{#if jsonError}
				<p class="nimble-config-json__error">{jsonError}</p>
			{/if}
		</section>
	{:else}
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

		{#if !item.reactive.system.properties.selected.includes('utilitySpell') && item.reactive.system.tier > 0}
			<ScalingConfig />
		{/if}
	{/if}
</section>

<style lang="scss">
	.nimble-config-toolbar {
		display: flex;
		justify-content: flex-end;

		&__toggle {
			opacity: 0.65;

			&:hover {
				opacity: 1;
			}
		}
	}

	.nimble-config-json {
		textarea {
			width: 100%;
			font-family: var(--font-mono, monospace);
			font-size: var(--nimble-sm-text);
			resize: vertical;
		}

		&__error {
			color: var(--color-level-error);
			font-size: var(--nimble-xs-text);
			margin: 0.25rem 0 0;
		}
	}
</style>
