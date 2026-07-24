<script lang="ts">
	import localize from '../../utils/localize.js';
	import TagGroup from '../components/TagGroup.svelte';
	import MovementSpeed from '../sheets/components/MovementSpeed.svelte';

	function prepareSizeCategoryOptions() {
		return Object.entries(sizeCategories).map(([key, value]) => ({
			label: value,
			value: key,
		}));
	}

	function prepareMonsterTypeOptions() {
		return [
			{ label: localize('TYPES.Actor.npc'), value: 'npc' },
			{ label: localize('TYPES.Actor.minion'), value: 'minion' },
			{ label: localize('TYPES.Actor.soloMonster'), value: 'soloMonster' },
		];
	}

	async function handleMonsterTypeChange(newValue: string) {
		if (newValue === actor.type) return;

		const confirmKey = 'NIMBLE.npcConfig.confirmMonsterTypeChange';
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: localize(`${confirmKey}.title`) },
			content: `<p>${localize(`${confirmKey}.message`, {
				current: localize(`TYPES.Actor.${actor.type}`),
				target: localize(`TYPES.Actor.${newValue}`),
			})}</p>`,
			rejectClose: false,
		});

		if (confirmed !== true) return;

		await actor.convertMonsterType(newValue);
	}

	function prepareDamageTypeOptions() {
		return Object.entries(damageTypes).map(([key, value]) => ({
			label: localize(value),
			value: key,
		}));
	}

	function toggleDamageTypeEntry(field: string, current: string[], value: string) {
		const next = current.includes(value)
			? current.filter((entry) => entry !== value)
			: [...current, value];
		actor.update({ [`system.attributes.${field}`]: next });
	}

	const { damageTypes, sizeCategories } = CONFIG.NIMBLE;

	let { actor } = $props();
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	<label class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.npcConfig.level')}
		</h3>

		<input
			type="text"
			value={actor.reactive.system.details.level}
			onchange={({ target }) => actor.update({ 'system.details.level': target.value })}
		/>
	</label>

	<label class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.npcConfig.creatureType')}
		</h3>

		<input
			type="text"
			value={actor.reactive.system.details.creatureType}
			onchange={({ target }) => actor.update({ 'system.details.creatureType': target.value })}
		/>
	</label>

	<div class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.npcConfig.sizeCategory')}
		</h3>

		<TagGroup
			options={prepareSizeCategoryOptions()}
			selectedOptions={[actor.reactive.system.attributes.sizeCategory]}
			toggleOption={(newValue) => actor.update({ 'system.attributes.sizeCategory': newValue })}
		/>
	</div>

	<div class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.npcConfig.monsterType')}
		</h3>

		<TagGroup
			options={prepareMonsterTypeOptions()}
			selectedOptions={[actor.reactive.type]}
			toggleOption={handleMonsterTypeChange}
		/>
	</div>

	<div class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.npcConfig.damageResistances')}
		</h3>

		<TagGroup
			options={prepareDamageTypeOptions()}
			selectedOptions={actor.reactive.system.attributes.damageResistances}
			toggleOption={(value) =>
				toggleDamageTypeEntry(
					'damageResistances',
					actor.reactive.system.attributes.damageResistances,
					value,
				)}
		/>
	</div>

	<div class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.npcConfig.damageImmunities')}
		</h3>

		<TagGroup
			options={prepareDamageTypeOptions()}
			selectedOptions={actor.reactive.system.attributes.damageImmunities}
			toggleOption={(value) =>
				toggleDamageTypeEntry(
					'damageImmunities',
					actor.reactive.system.attributes.damageImmunities,
					value,
				)}
		/>
	</div>

	<div class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">
			{localize('NIMBLE.npcConfig.damageVulnerabilities')}
		</h3>

		<TagGroup
			options={prepareDamageTypeOptions()}
			selectedOptions={actor.reactive.system.attributes.damageVulnerabilities}
			toggleOption={(value) =>
				toggleDamageTypeEntry(
					'damageVulnerabilities',
					actor.reactive.system.attributes.damageVulnerabilities,
					value,
				)}
		/>

		<small class="nimble-field__hint">
			{localize('NIMBLE.npcConfig.damageVulnerabilitiesHint')}
		</small>
	</div>

	{#if actor.reactive.type === 'npc'}
		<label class="nimble-field">
			<input
				type="checkbox"
				checked={actor.reactive.system.details.isFlunky}
				onchange={({ target }) => actor.update({ 'system.details.isFlunky': target.checked })}
			/>

			<h3 class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.npcConfig.flunky')}
			</h3>
		</label>
	{/if}

	<MovementSpeed {actor} showDefaultSpeed editingEnabled />
</section>

<style>
	.nimble-sheet__body {
		--nimble-sheet-body-padding-block-start: 0.5rem;
	}
</style>
