<script lang="ts">
	// Types

	// Helper Functions
	import { getContext } from 'svelte';
	import { createSubscriber } from 'svelte/reactivity';
	import type { NimbleCharacter } from '../../../documents/actor/character.js';
	import { registerCombatStateHooks } from '../../../utils/combatState.js';
	import { initiativeRollLock } from '../../../utils/initiativeRollLock.js';
	import localize from '../../../utils/localize.js';
	import replaceHyphenWithMinusSign from '../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';
	// Components
	import AbilityScores from '../components/AbilityScores.svelte';
	import ArmorClass from '../components/ArmorClass.svelte';
	import MovementSpeed from '../components/MovementSpeed.svelte';
	import SavingThrows from '../components/SavingThrows.svelte';
	import Skills from '../components/Skills.svelte';

	function getArmorProficiencies(proficiencies: Iterable<string>) {
		return [...proficiencies]
			.map((key): string => armorTypesPlural[key] ?? key)
			.sort((a, b) => a.localeCompare(b));
	}

	function getLanguageProficiencies(proficiencies: Iterable<string>) {
		return [...proficiencies]
			.map((key): string => languages[key] ?? key)
			.sort((a, b) => a.localeCompare(b));
	}

	function getWeaponProficiencies(proficiencies: Iterable<string>) {
		return [...proficiencies];
	}

	function getViewedCombatantForCurrentScene(): Combatant | null {
		const combat = game.combats?.viewed;
		const sceneId = canvas.scene?.id;
		if (!combat || !sceneId || combat.scene?.id !== sceneId) return null;
		return combat.combatants.find((entry) => entry.actorId === actor.id) ?? null;
	}

	async function rollInitiative() {
		if (initiativeRequestPending) return;
		initiativeRequestPending = true;

		try {
			const combat = game.combats?.viewed;
			const combatant = getViewedCombatantForCurrentScene();

			if (combatant) {
				if (initiativeRollLock.hasActiveLock(combatant)) return;
				if (combatant.initiative !== null) {
					ui.notifications?.info(localize('NIMBLE.ui.heroicActions.initiativeAlreadyRolled'));
					return;
				}
				if (!combat || !combatant.id) return;

				await combat.rollInitiative([combatant.id]);
				return;
			}

			const roll = Roll.create(actor._getInitiativeFormula({}), actor.getRollData());
			await roll.evaluate();

			await roll.toMessage({
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: game.i18n.format('COMBAT.RollsInitiative', { name: actor.name }),
				flags: { core: { initiativeRoll: true } },
			});
		} finally {
			initiativeRequestPending = false;
		}
	}

	const { armorTypesPlural, languages } = CONFIG.NIMBLE;
	let actor: NimbleCharacter = getContext('actor');
	const subscribeCombatState = createSubscriber(registerCombatStateHooks);
	let initiativeRequestPending = $state(false);

	let flags = $derived(actor.reactive.flags.nimble);
	let editingEnabled = $derived(flags?.editingEnabled ?? false);

	let skills = $derived(actor.reactive.system.skills);
	let abilities = $derived(actor.reactive.system.abilities);
	let characterSavingThrows = $derived(actor.reactive.system.savingThrows);
	let initiative = $derived(actor.reactive.system.attributes.initiative.mod);
	let initiativePending = $derived.by(() => {
		subscribeCombatState();
		if (initiativeRequestPending) return true;
		const combatant = getViewedCombatantForCurrentScene();
		if (!combatant) return false;
		return initiativeRollLock.hasActiveLock(combatant);
	});

	// Proficiencies
	let armorProficiencies = $derived(
		getArmorProficiencies(actor.reactive.system.proficiencies.armor),
	);

	let languageProficiencies = $derived(
		getLanguageProficiencies(actor.reactive.system.proficiencies.languages),
	);

	let weaponProficiencies = $derived(
		getWeaponProficiencies(actor.reactive.system.proficiencies.weapons),
	);
</script>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	<div class="nimble-attributes-wrapper">
		<AbilityScores {abilities} />

		<SavingThrows {characterSavingThrows} />

		<section class="nimble-other-attribute-wrapper" style="grid-area: initiative;">
			<header class="nimble-section-header" data-header-alignment="center">
				<h3 class="nimble-heading" data-heading-variant="section">Initiative</h3>
			</header>

			<button
				class="nimble-initiative"
				type="button"
				aria-label={localize('NIMBLE.prompts.rollInitiative')}
				data-tooltip="NIMBLE.prompts.rollInitiative"
				aria-busy={initiativePending}
				disabled={initiativePending}
				onclick={rollInitiative}
			>
				{replaceHyphenWithMinusSign(
					new Intl.NumberFormat('en-US', {
						signDisplay: 'always',
					}).format(initiative),
				)}
			</button>
		</section>

		<section class="nimble-other-attribute-wrapper" style="grid-area: armor;">
			<header class="nimble-section-header" data-header-alignment="center">
				<h3 class="nimble-heading" data-heading-variant="section">Armor</h3>
			</header>

			<ArmorClass armorClass={actor.reactive.system.attributes.armor.value} />
		</section>
	</div>

	<Skills {skills} />

	<MovementSpeed {actor} showDefaultSpeed={true} />

	{#each [{ heading: 'Language Proficiencies', configMethod: actor.configureLanguageProficiencies.bind(actor), content: languageProficiencies, prompt: 'configureLanguageProficiencies' }, { heading: 'Armor Proficiencies', configMethod: actor.configureArmorProficiencies.bind(actor), content: armorProficiencies, prompt: 'configureArmorProficiencies' }, { heading: 'Weapon Proficiencies', configMethod: actor.configureWeaponProficiencies.bind(actor), content: weaponProficiencies.filter((weapon) => weapon.trim().length > 0), prompt: 'configureWeaponProficiencies' }] as { heading, configMethod, content, prompt }}
		{@const tooltip = localize(`NIMBLE.prompts.${prompt}`)}

		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{heading}
				</h3>

				<button
					class="nimble-button"
					data-button-variant="icon"
					class:nimble-button--hidden={!editingEnabled}
					type="button"
					aria-label={editingEnabled ? tooltip : null}
					data-tooltip={editingEnabled ? tooltip : null}
					onclick={configMethod}
					disabled={!editingEnabled}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			</header>

			<ul class="nimble-proficiency-list">
				{#each content as label}
					<li class="nimble-proficiency-list__item">
						{label}
					</li>
				{:else}
					<li class="nimble-proficiency-list__item">None</li>
				{/each}
			</ul>
		</section>
	{/each}
</section>

<style lang="scss">
	.nimble-initiative {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		margin: 0;
		padding: 0;
		font-size: var(--nimble-md-text);
		font-weight: 900;
		color: var(--nimble-dark-input-text-color);
		background-color: var(--nimble-hp-bar-background);
		border: 2px solid var(--nimble-initiative-border-color);
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover,
		&:focus {
			border-color: var(--color-border-highlight);
			box-shadow: 0 0 6px var(--color-border-highlight);
		}

		&:disabled {
			cursor: wait;
			opacity: 0.7;
		}
	}

	.nimble-attributes-wrapper {
		display: grid;
		grid-template-areas:
			'abilityScores initiative'
			'savingThrows armor';
		grid-template-columns: 1fr max-content;
		grid-template-rows: repeat(2, max-content);
		gap: 0.75rem 0;
	}

	.nimble-other-attribute-wrapper {
		grid-area: other;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-items: center;
		grid-auto-flow: column;
		padding-inline: 0.25rem;
	}

	.nimble-proficiency-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1ch;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--nimble-sm-text);
		font-weight: 500;

		&__item {
			margin: 0;

			&:not(:last-child)::after {
				content: ',';
			}
		}
	}
</style>
