<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import type { NimbleCombat } from '../../documents/combat/combat.svelte.js';
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

	function updateCurrentCombat() {
		const viewedCombat = game.combats.viewed as NimbleCombat | null;

		if (!viewedCombat) {
			currentCombat = null;
			return;
		}

		if (!canvas.scene || viewedCombat.scene?.id !== canvas.scene.id) {
			currentCombat = null;
			return;
		}

		if (viewedCombat.combatants.size === 0) {
			currentCombat = null;
			return;
		}

		currentCombat = viewedCombat;
	}

	async function _onDrop(event: DragEvent & { currentTarget: EventTarget & HTMLOListElement }) {
		event.preventDefault();
		await currentCombat?._onDrop(event);
	}

	function rollInitiativeForAll(event) {
		event.preventDefault();
		currentCombat?.rollAll();
	}

	function startCombat(event): Promise<NimbleCombat> | undefined {
		event.preventDefault();
		return currentCombat?.startCombat();
	}

	let currentCombat: NimbleCombat | null = $state(null);

	let createCombatHook: number | undefined;
	let deleteCombatHook: number | undefined;
	let updateCombatHook: number | undefined;
	let createCombatantHook: number | undefined;
	let deleteCombatantHook: number | undefined;
	let renderSceneNavigationHook: number | undefined;
	let canvasReadyHook: number | undefined;

	onMount(() => {
		updateCurrentCombat();

		createCombatHook = Hooks.on('createCombat', (_combat) => {
			updateCurrentCombat();
		});

		deleteCombatHook = Hooks.on('deleteCombat', (_combat) => {
			updateCurrentCombat();
		});

		updateCombatHook = Hooks.on('updateCombat', (_combat) => {
			updateCurrentCombat();
		});

		createCombatantHook = Hooks.on('createCombatant', () => {
			updateCurrentCombat();
		});

		deleteCombatantHook = Hooks.on('deleteCombatant', () => {
			updateCurrentCombat();
		});

		renderSceneNavigationHook = Hooks.on('renderSceneNavigation', () => {
			updateCurrentCombat();
		});

		canvasReadyHook = Hooks.on('canvasReady', () => {
			updateCurrentCombat();
		});
	});

	onDestroy(() => {
		if (createCombatHook !== undefined) Hooks.off('createCombat', createCombatHook);
		if (deleteCombatHook !== undefined) Hooks.off('deleteCombat', deleteCombatHook);
		if (updateCombatHook !== undefined) Hooks.off('updateCombat', updateCombatHook);
		if (createCombatantHook !== undefined) Hooks.off('createCombatant', createCombatantHook);
		if (deleteCombatantHook !== undefined) Hooks.off('deleteCombatant', deleteCombatantHook);
		if (renderSceneNavigationHook !== undefined)
			Hooks.off('renderSceneNavigation', renderSceneNavigationHook);
		if (canvasReadyHook !== undefined) Hooks.off('canvasReady', canvasReadyHook);
	});
</script>

{#if currentCombat}
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
