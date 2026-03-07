<script lang="ts">
	import TagGroup from '../components/TagGroup.svelte';
	import MovementSpeed from '../sheets/components/MovementSpeed.svelte';

	function prepareSizeCategoryOptions() {
		return Object.entries(sizeCategories).map(([key, value]) => ({
			label: value,
			value: key,
		}));
	}

	const { sizeCategories } = CONFIG.NIMBLE;

	let { actor } = $props();
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	<label class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">Level</h3>

		<input
			type="text"
			value={actor.reactive.system.details.level}
			onchange={({ target }) => actor.update({ 'system.details.level': target.value })}
		/>
	</label>

	<label class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">Creature Type</h3>

		<input
			type="text"
			value={actor.reactive.system.details.creatureType}
			onchange={({ target }) => actor.update({ 'system.details.creatureType': target.value })}
		/>
	</label>

	<div class="nimble-field" data-field-variant="stacked">
		<h3 class="nimble-heading" data-heading-variant="field">Size Category</h3>

		<TagGroup
			options={prepareSizeCategoryOptions()}
			selectedOptions={[actor.reactive.system.attributes.sizeCategory]}
			toggleOption={(newValue) => actor.update({ 'system.attributes.sizeCategory': newValue })}
		/>
	</div>

	{#if actor.type === 'npc'}
		<label class="nimble-field">
			<input
				type="checkbox"
				checked={actor.reactive.system.details.isFlunky}
				onchange={({ target }) => actor.update({ 'system.details.isFlunky': target.checked })}
			/>

			<h3 class="nimble-heading" data-heading-variant="field">Flunky</h3>
		</label>
	{/if}

	<MovementSpeed {actor} showDefaultSpeed={true} />
</section>

<style>
	.nimble-sheet__body {
		--nimble-sheet-body-padding-block-start: 0.5rem;
	}
</style>
