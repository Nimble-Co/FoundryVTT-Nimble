<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import TagGroup from '../../components/TagGroup.svelte';

	let item = getContext('document');

	const { containerSlotCostModes, objectTypes } = CONFIG.NIMBLE;

	let container = $derived(item.reactive.system.container);

	function getSlotCostModeOptions() {
		return Object.entries(containerSlotCostModes).map(([key, mode]) => ({
			label: mode,
			value: key,
		}));
	}

	function getObjectTypeOptions() {
		return Object.entries(objectTypes).map(([key, objectType]) => ({
			label: objectType,
			value: key,
		}));
	}

	function updateSlotCostMode(newSelection) {
		item.update({ 'system.container.slotCostMode': newSelection });
	}

	function updateAllowedObjectTypes(newSelection) {
		const allowedObjectTypes = container.allowedObjectTypes ?? [];

		item.update({
			'system.container.allowedObjectTypes': allowedObjectTypes.includes(newSelection)
				? allowedObjectTypes.filter((objectType) => objectType !== newSelection)
				: [...allowedObjectTypes, newSelection],
		});
	}

	function updateCapacity(value) {
		item.update({ 'system.container.capacity': value === '' ? null : Number(value) });
	}

	/** A blank field means the GM cleared it, not that the reduction is now zero. */
	function updateSlotCostReduction(target) {
		if (target.value === '') {
			target.value = String(container.slotCostReduction);
			return;
		}

		item.update({ 'system.container.slotCostReduction': Number(target.value) });
	}
</script>

<div>
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.containers.heading')}
		</h3>
	</header>

	<label class="nimble-field">
		<input
			type="checkbox"
			checked={container.enabled}
			onchange={({ target }) => item.update({ 'system.container.enabled': target.checked })}
		/>

		<span class="nimble-heading nimble-field__label" data-heading-variant="field">
			{localize('NIMBLE.containers.enabled')}

			<i
				class="nimble-field__hint-icon fa-solid fa-circle-info"
				data-tooltip={localize('NIMBLE.containers.enabledHint')}
				data-tooltip-direction="UP"
			></i>
		</span>
	</label>

	{#if container.enabled}
		<div class="nimble-field nimble-field--column">
			<span class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.containers.slotCostMode')}
			</span>

			<TagGroup
				options={getSlotCostModeOptions()}
				selectedOptions={[container.slotCostMode]}
				toggleOption={updateSlotCostMode}
			/>
		</div>

		{#if container.slotCostMode === 'reduce'}
			<label class="nimble-field nimble-field--column">
				<span class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.containers.slotCostReduction')}
				</span>

				<input
					type="number"
					min="0"
					step="0.5"
					value={container.slotCostReduction}
					onchange={({ target }) => updateSlotCostReduction(target)}
				/>
			</label>
		{/if}

		<label class="nimble-field nimble-field--column">
			<span class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.containers.capacity')}

				<i
					class="nimble-field__hint-icon fa-solid fa-circle-info"
					data-tooltip={localize('NIMBLE.containers.capacityHint')}
					data-tooltip-direction="UP"
				></i>
			</span>

			<input
				type="number"
				min="0"
				step="0.5"
				value={container.capacity ?? ''}
				onchange={({ target }) => updateCapacity(target.value)}
			/>
		</label>

		<div class="nimble-field nimble-field--column">
			<span class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.containers.allowedObjectTypes')}

				<i
					class="nimble-field__hint-icon fa-solid fa-circle-info"
					data-tooltip={localize('NIMBLE.containers.allowedObjectTypesHint')}
					data-tooltip-direction="UP"
				></i>
			</span>

			<TagGroup
				options={getObjectTypeOptions()}
				selectedOptions={container.allowedObjectTypes}
				toggleOption={updateAllowedObjectTypes}
			/>
		</div>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={container.requiresEquipped}
				onchange={({ target }) =>
					item.update({ 'system.container.requiresEquipped': target.checked })}
			/>

			<span class="nimble-heading nimble-field__label" data-heading-variant="field">
				{localize('NIMBLE.containers.requiresEquipped')}
			</span>
		</label>
	{/if}
</div>
