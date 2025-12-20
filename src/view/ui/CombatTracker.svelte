<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import BaseCombatant from './components/BaseCombatant.svelte';
	import CombatTrackerControls from './components/CombatTrackerControls.svelte';
	import PlayerCharacterCombatant from './components/PlayerCharacterCombatant.svelte';

	type CombatWithDrop = Combat & {
		_onDrop?: (
			event: DragEvent & { target: EventTarget & HTMLElement },
		) => Promise<void | boolean | Combatant.Implementation[]>;
	};

	function getCombatForCurrentScene(): Combat | null {
		const sceneId = canvas.scene?.id;

		const activeCombat = game.combat;
		// Show active combat if it has combatants and either:
		// - matches the current scene, OR
		// - has no scene association (scene-less combat)
		if (activeCombat && activeCombat.combatants.size > 0) {
			const combatSceneId = activeCombat.scene?.id;
			if (!combatSceneId || combatSceneId === sceneId) {
				return activeCombat;
			}
		}

		const viewedCombat = game.combats.viewed ?? null;
		// Same logic for viewed combat
		if (viewedCombat && viewedCombat.combatants.size > 0) {
			const combatSceneId = viewedCombat.scene?.id;
			if (!combatSceneId || combatSceneId === sceneId) {
				return viewedCombat;
			}
		}

		return null;
	}

	function getCombatantComponent(combatant: Combatant.Implementation) {
		switch (combatant.type) {
			case 'character':
				return PlayerCharacterCombatant;
			default:
				return BaseCombatant;
		}
	}

	function updateCurrentCombat() {
		currentCombat = getCombatForCurrentScene();
		version++;
	}

	async function _onDrop(event: DragEvent) {
		event.preventDefault();
		if (!(event.target instanceof HTMLElement)) return;

		const combat = currentCombat as CombatWithDrop | null;
		if (typeof combat?._onDrop !== 'function') return;
		await combat._onDrop(event as DragEvent & { target: EventTarget & HTMLElement });
	}

	function rollInitiativeForAll(event: MouseEvent) {
		event.preventDefault();
		currentCombat?.rollAll();
	}

	function startCombat(event: MouseEvent): Promise<Combat> | undefined {
		event.preventDefault();
		return currentCombat?.startCombat();
	}

	let currentCombat: Combat | null = $state(null);
	// Version counter to force re-renders when combat data changes
	// (since the Combat object reference may stay the same)
	let version = $state(0);

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

		// Some cores fire a dedicated hook when combat begins; ensure we update for that too.
		const combatStartHook = Hooks.on('combatStart', () => {
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

		return () => Hooks.off('combatStart', combatStartHook);
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
			class:nimble-combat-tracker__header--not-started={currentCombat?.round === 0}
			in:slide={{ axis: 'y', delay: 200 }}
			out:fade={{ delay: 0 }}
		>
			{#if currentCombat?.round === 0 && game.user!.isGM}
				<button class="nimble-combat-tracker__start-button" onclick={startCombat}>
					Start Combat
				</button>
			{:else if currentCombat?.round === 0}
				<h2 class="nimble-combat-tracker__heading">Combat Not Started</h2>
			{:else}
				<h2 class="nimble-combat-tracker__heading">
					Round {currentCombat?.round}
				</h2>
			{/if}

			{#if currentCombat?.round !== 0 && game.user!.isGM}
				<CombatTrackerControls />
			{/if}
		</header>

		<ol class="nimble-combatants" ondrop={(event) => _onDrop(event)} out:fade={{ delay: 0 }}>
			{#key version}
				{#each currentCombat?.turns as combatant, index (combatant.id)}
					{@const CombatantComponent = getCombatantComponent(combatant)}

					{#if combatant.visible}
						<li class="nimble-combatants__item">
							<CombatantComponent
								active={currentCombat.combatant?.id === combatant.id}
								{combatant}
								{index}
							/>
						</li>
					{/if}
				{/each}
			{/key}
		</ol>

		{#if game.user!.isGM && currentCombat?.combatants.contents.some((combatant) => combatant.initiative === null)}
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
