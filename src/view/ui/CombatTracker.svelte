<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import type { NimbleCombat } from '../../documents/combat/combat.svelte';
	import BaseCombatant from './components/BaseCombatant.svelte';
	import CombatTrackerControls from './components/CombatTrackerControls.svelte';
	import PlayerCharacterCombatant from './components/PlayerCharacterCombatant.svelte';

	function getCombatantComponent(combatant) {
		switch (combatant.type) {
			case 'character':
				return PlayerCharacterCombatant;
			default:
				return BaseCombatant;
		}
	}

	async function _onDrop(event: DragEvent & { currentTarget: EventTarget & HTMLOListElement }) {
		event.preventDefault();
		await (game.combat as NimbleCombat)?._onDrop(event);
	}

	function rollInitiativeForAll(event) {
		event.preventDefault();
		(game.combat as NimbleCombat)?.rollAll();
	}

	function startCombat(event): Promise<NimbleCombat> | undefined {
		event.preventDefault();
		return (game.combat as NimbleCombat)?.startCombat();
	}

	const createCombat = Hooks.on('createCombat', (_combat) => {
		currentCombat = (game.combat as NimbleCombat) ?? null;
	});

	const deleteCombat = Hooks.on('deleteCombat', (_combat) => {
		currentCombat = (game.combat as NimbleCombat) ?? null;
	});

	const renderSceneNavigation = Hooks.on('renderSceneNavigation', () => {
		currentCombat = (game.combat as NimbleCombat) ?? null;
	});

	onDestroy(() => {
		Hooks.off('createCombat', createCombat);
		Hooks.off('deleteCombat', deleteCombat);
		Hooks.off('renderSceneNavigation', renderSceneNavigation);
	});

	let currentCombat: NimbleCombat | null = $state(null);
</script>

{#if currentCombat?.reactive?.active}
	<section class="nimble-combat-tracker" transition:slide={{ axis: 'x' }}>
		<header
			class="nimble-combat-tracker__header"
			class:nimble-combat-tracker__header--no-controls={!game.user!.isGM}
			class:nimble-combat-tracker__header--not-started={currentCombat?.reactive?.round === 0}
			in:slide={{ axis: 'y', delay: 200 }}
			out:fade={{ delay: 0 }}
		>
			{#if currentCombat?.reactive?.round === 0}
				<button class="nimble-combat-tracker__start-button" onclick={startCombat}>
					Start Combat
				</button>
			{:else}
				<h2 class="nimble-combat-tracker__heading">
					Round {currentCombat?.reactive?.round}
				</h2>
			{/if}

			{#if currentCombat?.reactive?.round !== 0 && game.user!.isGM}
				<CombatTrackerControls />
			{/if}
		</header>

		<ol class="nimble-combatants" ondrop={(event) => _onDrop(event)} out:fade={{ delay: 0 }}>
			{#each currentCombat?.reactive?.turns as combatant, index (combatant._id)}
				{@const CombatantComponent = getCombatantComponent(combatant)}

				{#if combatant.visible}
					<li class="nimble-combatants__item">
						<CombatantComponent
							active={currentCombat.reactive?.combatant?.id === combatant.id}
							{combatant}
							{index}
						/>
					</li>
				{/if}
			{/each}
		</ol>

		{#if currentCombat?.reactive?.combatants.some((combatant) => combatant.initiative === null)}
			<footer class="nimble-combat-tracker__footer">
				<div class="nimble-combat-tracker__footer-roll-container">
					<button
						class="nimble-combat-tracker__footer-button"
						type="button"
						aria-label="Roll All"
						data-tooltip="Roll All"
						data-tooltip-direction="UP"
						onclick={(event) => rollInitiativeForAll(event)}
					>
						<i class="fa-solid fa-users"></i>
					</button>
				</div>
			</footer>
		{/if}
	</section>
{/if}
