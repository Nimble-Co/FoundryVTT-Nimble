<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import localize from '../../utils/localize.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import { CLASS_SHEET_TAB_CONFIG, type ClassSheetTabName } from './ClassSheetConstants.js';
	import { createClassSheetState } from './ClassSheet.classState.svelte.js';
	import type { ClassSheetProps } from '#types/components/ClassSheet.d.ts';

	import ClassProgressionTab from './pages/ClassProgressionTab.svelte';
	import Editor from './components/Editor.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import TagGroup from '../components/TagGroup.svelte';

	let { item, sheet }: ClassSheetProps = $props();

	const classState = createClassSheetState(() => ({ item, sheet }));

	const snippetsByTab: Record<ClassSheetTabName, () => void> = {
		description: descriptionTab,
		config: configTab,
		progression: progressionTab,
		rules: rulesTab,
	};

	const navigation = CLASS_SHEET_TAB_CONFIG.map((tab) => ({
		...tab,
		tooltip: localize(tab.tooltip),
		component: snippetsByTab[tab.name],
	}));

	let currentTab = $state(navigation[0]);

	setContext(
		'document',
		untrack(() => item),
	);
	setContext(
		'application',
		untrack(() => sheet),
	);
</script>

{#snippet configTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.identifier')}
				</h3>
			</header>

			<input
				type="text"
				value={item.reactive.identifier || ''}
				onchange={({ target }) => item.update({ 'system.identifier': target.value })}
			/>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.classComplexity')}
				</h3>
			</header>

			<input
				type="number"
				value={item.reactive.system.complexity || 1}
				onchange={({ currentTarget }) =>
					item.update({
						'system.complexity': Number(currentTarget.value),
					})}
			/>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.keyStats')}
				</h3>
			</header>

			<TagGroup
				grid={true}
				options={classState.abilityScoreOptions}
				selectedOptions={item.reactive.system.keyAbilityScores}
				toggleOption={classState.toggleKeyAbilityScoreOption}
				disabled={item.reactive.system.keyAbilityScores.length > 1}
				--nimble-tag-group-grid-columns="repeat(4, 1fr)"
			/>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{classState.saves.advantageSave}
				</h3>
			</header>

			<TagGroup
				grid={true}
				options={classState.savingThrowOptions}
				selectedOptions={[item.reactive.system.savingThrows.advantage]}
				toggleOption={classState.toggleAdvantageSavingThrow}
				--nimble-tag-group-grid-columns="repeat(4, 1fr)"
			/>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{classState.saves.disadvantageSave}
				</h3>
			</header>

			<TagGroup
				grid={true}
				options={classState.savingThrowOptions}
				selectedOptions={[item.reactive.system.savingThrows.disadvantage]}
				toggleOption={classState.toggleDisadvantageSavingThrow}
				--nimble-tag-group-grid-columns="repeat(4, 1fr)"
			/>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.hitDieSize')}
				</h3>
			</header>

			<TagGroup
				grid={true}
				options={classState.hitDieOptions}
				selectedOptions={[item.reactive.system.hitDieSize]}
				toggleOption={classState.toggleHitDieSize}
				--nimble-tag-group-grid-columns="repeat(7, 1fr)"
			/>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.manaFormula')}
				</h3>
			</header>

			<input
				type="text"
				value={item.reactive.system.mana.formula || ''}
				onchange={({ currentTarget }) =>
					item.update({ 'system.mana.formula': currentTarget.value })}
			/>
		</section>

		{#if item.reactive.system.mana.formula.length}
			<section>
				<header class="nimble-section-header">
					<h3 class="nimble-heading" data-heading-variant="field">
						{localize('NIMBLE.classSheet.manaRecovery')}
					</h3>
				</header>

				<TagGroup
					grid={true}
					options={classState.manaRecoveryOptions}
					selectedOptions={[item.reactive.system.mana.recovery]}
					toggleOption={classState.toggleManaRecoveryType}
					--nimble-tag-group-grid-columns="repeat(3, 1fr)"
				/>
			</section>
		{/if}

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.armorProficiencies')}
				</h3>
			</header>

			<TagGroup
				options={classState.armorOptions}
				selectedOptions={item.reactive.system.armorProficiencies}
				toggleOption={classState.toggleArmorProficiency}
			/>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.weaponProficiencies')}
				</h3>

				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					data-tooltip="NIMBLE.classSheet.addWeaponProficiency"
					aria-label={localize('NIMBLE.classSheet.addWeaponProficiency')}
					onclick={classState.addWeaponProficiency}
				>
					<i class="fa-solid fa-square-plus"></i>
				</button>
			</header>

			<ul class="nimble-weapon-proficiency-list">
				{#key item.reactive.system.weaponProficiencies}
					{#each item.reactive.system.weaponProficiencies as weapon, index}
						<li class="nimble-weapon-proficiency-list__item">
							<input
								type="text"
								value={weapon}
								onchange={(event) => classState.updateWeaponProficiency(index, event.target.value)}
							/>

							<button
								class="nimble-button nimble-weapon-proficiency-list__delete-button"
								data-button-variant="icon"
								data-tooltip="NIMBLE.classSheet.deleteWeaponProficiency"
								aria-label={localize('NIMBLE.classSheet.deleteWeaponProficiency')}
								onclick={() => classState.deleteWeaponProficiency(index)}
								type="button"
							>
								<i class="fa-solid fa-trash"></i>
							</button>
						</li>
					{:else}
						<li class="nimble-weapon-proficiency-list__item">
							{localize('NIMBLE.classSheet.none')}
						</li>
					{/each}
				{/key}
			</ul>
		</section>

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.classSheet.featureGroups')}
				</h3>

				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					data-tooltip="NIMBLE.classSheet.addFeatureGroup"
					aria-label={localize('NIMBLE.classSheet.addFeatureGroup')}
					onclick={classState.addFeatureGroup}
				>
					<i class="fa-solid fa-square-plus"></i>
				</button>
			</header>

			<ul class="nimble-weapon-proficiency-list">
				{#key item.reactive.system.groupIdentifiers}
					{#each item.reactive.system.groupIdentifiers ?? [] as featureGroup, index}
						<li class="nimble-weapon-proficiency-list__item">
							<input
								type="text"
								value={featureGroup}
								onchange={(event) => classState.updateFeatureGroup(index, event.target.value)}
							/>

							<button
								class="nimble-button nimble-weapon-proficiency-list__delete-button"
								data-button-variant="icon"
								data-tooltip="NIMBLE.classSheet.deleteFeatureGroup"
								aria-label={localize('NIMBLE.classSheet.deleteFeatureGroup')}
								onclick={() => classState.deleteFeatureGroup(index)}
								type="button"
							>
								<i class="fa-solid fa-trash"></i>
							</button>
						</li>
					{:else}
						<li class="nimble-weapon-proficiency-list__item">
							{localize('NIMBLE.classSheet.none')}
						</li>
					{/each}
				{/key}
			</ul>
		</section>

		{#each item.reactive.system.resources as resource (resource.identifier)}
			<div>
				{resource.name}
			</div>
		{/each}
	</section>
{/snippet}

{#snippet descriptionTab()}
	{#key item.reactive.system.description}
		<section class="nimble-sheet__body">
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.classSheet.description')}
				</h3>
			</header>

			<Editor
				field="system.description"
				content={item.reactive.system.description}
				document={item}
			/>
		</section>
	{/key}
{/snippet}

{#snippet progressionTab()}
	<ClassProgressionTab />
{/snippet}

{#snippet rulesTab()}
	<ItemRulesTab></ItemRulesTab>
{/snippet}

<header class="nimble-sheet__header nimble-sheet__header--item">
	<section class="nimble-icon">
		<button
			class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
			type="button"
			aria-label={localize('NIMBLE.prompts.changeClassImage')}
			data-tooltip="NIMBLE.prompts.changeClassImage"
			onclick={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		>
			<img class="nimble-icon__image" src={item.reactive.img} alt={item.reactive.name} />
		</button>
	</section>

	<ItemHeader {item} placeholder="Class Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab.component()}

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
