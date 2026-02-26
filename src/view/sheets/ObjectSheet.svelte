<script>
	import { setContext } from 'svelte';
	import localize from '../../utils/localize.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';

	import ItemActivationConfigTab from './pages/ItemActivationConfigTab.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemMacroTab from './pages/ItemMacroTab.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import ObjectDescriptionTab from './pages/ObjectDescriptionTab.svelte';
	import RangeConfig from './components/RangeConfig.svelte';
	import ReachConfig from './components/ReachConfig.svelte';
	import TagGroup from '../components/TagGroup.svelte';

	function getObjectTypeOptions() {
		return Object.entries(objectTypes).map(([key, objectType]) => ({
			label: objectType,
			value: key,
		}));
	}

	function getObjectSizeTypeOptions() {
		return Object.entries(objectSizeTypes).map(([key, objectSizeType]) => ({
			label: objectSizeType,
			value: key,
		}));
	}

	function getWeaponPropertyOptions() {
		return Object.entries(weaponProperties).map(([key, weaponProperty]) => ({
			label: weaponProperty,
			value: key,
		}));
	}

	function updateObjectType(newSelection) {
		item.update({
			'system.objectType': newSelection,
		});
	}

	function updateObjectSizeType(newSelection) {
		item.update({
			'system.objectSizeType': newSelection,
		});
	}

	function updateWeaponProperties(newSelection) {
		const currentProperties = item.reactive?.system?.properties?.selected ?? [];

		if (currentProperties.includes(newSelection)) {
			item.update({
				'system.properties.selected': currentProperties.filter(
					(property) => property !== newSelection,
				),
			});

			return;
		}

		item.update({
			'system.properties.selected': [...currentProperties, newSelection],
		});
	}

	const { objectTypes, objectSizeTypes, weaponProperties } = CONFIG.NIMBLE;

	let { item, sheet } = $props();

	const navigation = [
		{
			component: descriptionTab,
			icon: 'fa-solid fa-file-lines',
			tooltip: 'Description',
			name: 'description',
		},
		{
			component: configTab,
			icon: 'fa-solid fa-gears',
			tooltip: 'Config',
			name: 'config',
		},
		{
			component: activationConfigTab,
			icon: 'fa-solid fa-play',
			tooltip: 'Activation',
			name: 'activationConfig',
		},
		{
			component: rulesTab,
			icon: 'fa-solid fa-bolt',
			tooltip: 'Rules',
			name: 'rules',
		},
		{
			component: macroTab,
			icon: 'fa-solid fa-terminal',
			tooltip: 'Macro',
			name: 'macro',
		},
	];

	let currentTab = $state(navigation[0]);
	let thrownRange = $derived(item.reactive.system.properties.thrownRange ?? 0);

	let strengthRequirement = $derived(
		item.reactive.system.properties.strengthRequirement.value ?? 0,
	);
	let strengthRequirementOverridesTwoHanded = $derived(
		item.reactive.system.properties.strengthRequirement.overridesTwoHanded,
	);

	let objectType = $derived(item.reactive.system.objectType);
	let objectSizeType = $derived(item.reactive.system.objectSizeType);

	setContext('document', item);
	setContext('application', sheet);
</script>

{#snippet activationConfigTab()}
	<ItemActivationConfigTab></ItemActivationConfigTab>
{/snippet}

{#snippet configTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Identifier</h3>
			</header>

			<input
				type="text"
				value={item.reactive.identifier || ''}
				onchange={({ target }) => item.update({ 'system.identifier': target.value })}
			/>
		</div>

		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.objectSheet.price')}
				</h3>
			</header>

			<div class="nimble-price-field">
				<input
					class="nimble-price-field__value"
					type="number"
					min="0"
					step="1"
					value={item.reactive.system.price?.value ?? 0}
					onchange={({ target }) =>
						item.update({
							'system.price.value': Number(target.value),
						})}
				/>

				<select
					class="nimble-price-field__denomination"
					value={item.reactive.system.price?.denomination ?? 'gp'}
					onchange={({ target }) =>
						item.update({
							'system.price.denomination': target.value,
						})}
				>
					<option value="cp">{localize('NIMBLE.currencyAbbreviations.cp')}</option>
					<option value="sp">{localize('NIMBLE.currencyAbbreviations.sp')}</option>
					<option value="gp">{localize('NIMBLE.currencyAbbreviations.gp')}</option>
				</select>
			</div>
		</div>

		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">General Configuration</h3>
			</header>

			<div class="nimble-field nimble-field--column">
				<span class="nimble-heading" data-heading-variant="field"> Object Type </span>

				<TagGroup
					options={getObjectTypeOptions()}
					selectedOptions={[item.reactive.system.objectType]}
					toggleOption={updateObjectType}
				/>
			</div>

			<div class="nimble-field nimble-field--column">
				<span class="nimble-heading" data-heading-variant="field"> Object Size Type </span>

				<TagGroup
					options={getObjectSizeTypeOptions()}
					selectedOptions={[item.reactive.system.objectSizeType]}
					toggleOption={updateObjectSizeType}
				/>
			</div>

			{#if objectSizeType === 'slots'}
				<div class="nimble-field nimble-field--column">
					<span class="nimble-heading" data-heading-variant="field">
						Inventory Slots

						<i
							class="nimble-field__hint-icon fa-solid fa-circle-info"
							data-tooltip="How many slots this item takes up. Enter 0.5 for potions."
							data-tooltip-direction="UP"
						></i>
					</span>

					<input
						type="number"
						value={item.reactive.system.slotsRequired || 0}
						onchange={({ target }) =>
							item.update({
								'system.slotsRequired': target.value,
							})}
						disabled={objectSizeType != 'slots'}
					/>
				</div>
			{/if}

			{#if objectSizeType === 'stackable'}
				<div class="nimble-field nimble-field--column">
					<span class="nimble-heading" data-heading-variant="field">
						Stack Size

						<i
							class="nimble-field__hint-icon fa-solid fa-circle-info"
							data-tooltip="How many of this item can fit into a single stack."
							data-tooltip-direction="UP"
						></i>
					</span>

					<input
						type="number"
						min="2"
						step="1"
						value={item.reactive.system.stackSize || 2}
						onchange={({ target }) =>
							item.update({
								'system.stackSize': target.value,
							})}
						disabled={objectSizeType != 'stackable'}
					/>
				</div>
			{/if}
		</div>

		{#if objectType === 'weapon'}
			{@const itemWeaponProperties = item.reactive?.system?.properties?.selected ?? []}

			<div>
				<header class="nimble-section-header">
					<h3 class="nimble-heading" data-heading-variant="section">Weapon Configuration</h3>
				</header>

				<div class="nimble-field" data-field-variant="stacked">
					<span class="nimble-heading nimble-field__label" data-heading-variant="field">
						Weapon Properties
					</span>

					<TagGroup
						options={getWeaponPropertyOptions()}
						selectedOptions={itemWeaponProperties}
						toggleOption={updateWeaponProperties}
					/>
				</div>
			</div>

			{#if itemWeaponProperties?.includes('range')}
				<RangeConfig {item} />
			{/if}

			{#if itemWeaponProperties?.includes('reach')}
				<ReachConfig {item} />
			{/if}

			{#if itemWeaponProperties?.includes('twoHanded')}
				<div>
					<header class="nimble-section-header">
						<h3 class="nimble-heading" data-heading-variant="section">Strength Requirement</h3>
					</header>

					<input
						type="number"
						value={strengthRequirement}
						onchange={({ target }) =>
							item.update({
								'system.properties.strengthRequirement.value': target?.value,
							})}
					/>

					<label class="nimble-field">
						<input
							type="checkbox"
							checked={strengthRequirementOverridesTwoHanded}
							onchange={({ target }) =>
								item.update({
									'system.properties.strengthRequirement.overridesTwoHanded': target.checked,
								})}
						/>

						<span class="nimble-heading nimble-field__label" data-heading-variant="field">
							Strength Requirement Overrides 2-Handed
						</span>
					</label>
				</div>
			{/if}

			{#if itemWeaponProperties?.includes('thrown')}
				<div>
					<header class="nimble-section-header">
						<h3 class="nimble-heading" data-heading-variant="section">Thrown Range</h3>
					</header>

					<input
						type="number"
						value={thrownRange}
						onchange={({ target }) =>
							item.update({
								'system.properties.thrownRange': target?.value,
							})}
					/>
				</div>
			{/if}
		{/if}
	</section>
{/snippet}

{#snippet descriptionTab()}
	<ObjectDescriptionTab></ObjectDescriptionTab>
{/snippet}

{#snippet macroTab()}
	<ItemMacroTab></ItemMacroTab>
{/snippet}

{#snippet rulesTab()}
	<ItemRulesTab></ItemRulesTab>
{/snippet}

<header class="nimble-sheet__header nimble-sheet__header--item">
	<section class="nimble-icon">
		<button
			class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
			type="button"
			aria-label={localize('NIMBLE.prompts.changeItemImage')}
			data-tooltip="NIMBLE.prompts.changeItemImage"
			onclick={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		>
			<img class="nimble-icon__image" src={item.reactive.img} alt={item.reactive.name} />
		</button>
	</section>

	<ItemHeader {item} placeholder="Object Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab.component()}

<style lang="scss">
	.nimble-price-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;

		&__value {
			flex: 1;
		}

		&__denomination {
			flex: 0 0 auto;
			width: auto;
		}
	}
</style>
