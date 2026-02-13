<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import BaseCombatant from './components/BaseCombatant.svelte';
	import CombatTrackerControls from './components/CombatTrackerControls.svelte';
	import PlayerCharacterCombatant from './components/PlayerCharacterCombatant.svelte';
	import MonsterCombatant from '#view/ui/components/MonsterCombatant.svelte';

	type CombatWithDrop = Combat & {
		_onDrop?: (
			event: DragEvent & { target: EventTarget & HTMLElement },
		) => Promise<void | boolean | Combatant.Implementation[]>;
	};

	interface SceneCombatantLists {
		activeCombatants: Combatant.Implementation[];
		deadCombatants: Combatant.Implementation[];
	}

	function getCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
		// Try multiple ways to get the combatant's scene ID
		// 1. Direct sceneId property
		if (combatant.sceneId) return combatant.sceneId;
		// 2. Token's parent scene
		if (combatant.token?.parent?.id) return combatant.token.parent.id;
		// 3. Check if token document exists on current scene
		const sceneId = canvas.scene?.id;
		if (sceneId && combatant.tokenId) {
			const tokenDoc = canvas.scene?.tokens?.get(combatant.tokenId);
			if (tokenDoc) return sceneId;
		}
		return undefined;
	}

	function hasCombatantsForScene(combat: Combat, sceneId: string): boolean {
		return combat.combatants.contents.some((c) => getCombatantSceneId(c) === sceneId);
	}

	function isDeadCombatant(combatant: Combatant.Implementation): boolean {
		const hpValue = (
			combatant.actor?.system as {
				attributes?: { hp?: { value?: number } };
			}
		)?.attributes?.hp?.value;

		if (combatant.type === 'character') return combatant.defeated;
		return combatant.defeated || (typeof hpValue === 'number' && hpValue <= 0);
	}

	function getCombatantsForScene(
		combat: Combat | null,
		sceneId: string | undefined,
	): SceneCombatantLists {
		if (!sceneId || !combat) return { activeCombatants: [], deadCombatants: [] };

		const combatantsForScene = combat.combatants.contents.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);
		const turnCombatants = combat.turns.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);

		const turnCombatantIds = new Set(turnCombatants.map((c) => c.id));
		const activeCombatants = turnCombatants.filter((combatant) => !isDeadCombatant(combatant));
		const missingActiveCombatants = combatantsForScene.filter(
			(combatant) => !isDeadCombatant(combatant) && !turnCombatantIds.has(combatant.id ?? ''),
		);

		const deadCombatants = combatantsForScene
			.filter((combatant) => isDeadCombatant(combatant))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

		return {
			activeCombatants: [...activeCombatants, ...missingActiveCombatants],
			deadCombatants,
		};
	}

	function getCombatForCurrentScene(): Combat | null {
		const sceneId = canvas.scene?.id;
		if (!sceneId) return null;

		// Find combats that have combatants belonging to the current scene
		const combatsForScene = game.combats.contents.filter(
			(combat) => combat.combatants.size > 0 && hasCombatantsForScene(combat, sceneId),
		);

		// Prefer the active combat if it has combatants for this scene
		const activeCombat = game.combat;
		if (activeCombat && combatsForScene.includes(activeCombat)) {
			return activeCombat;
		}

		// Otherwise return the first combat that has combatants for this scene
		return combatsForScene[0] ?? null;
	}

	function getCombatantComponent(combatant: Combatant.Implementation) {
		switch (combatant.type) {
			case 'character':
				return PlayerCharacterCombatant;
			case 'soloMonster':
			case 'npc': // TODO: For now NPCs are monsters in regards to the combat tracker
				return MonsterCombatant;
			default:
				return BaseCombatant;
		}
	}

	function updateCurrentCombat() {
		// Use queueMicrotask to ensure Foundry's data is fully updated
		// before we read it, and to batch Svelte's reactivity updates
		queueMicrotask(() => {
			const combat = getCombatForCurrentScene();
			const sceneId = canvas.scene?.id;
			const { activeCombatants, deadCombatants } = getCombatantsForScene(combat, sceneId);
			currentCombat = combat;
			sceneCombatants = activeCombatants;
			sceneDeadCombatants = deadCombatants;
			version++;
		});
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
	// Combatants filtered to only those belonging to the current scene
	let sceneCombatants: Combatant.Implementation[] = $state([]);
	let sceneDeadCombatants: Combatant.Implementation[] = $state([]);
	// Version counter to force re-renders when combat data changes
	// (since the Combat object reference may stay the same)
	let version = $state(0);

	let createCombatHook: number | undefined;
	let deleteCombatHook: number | undefined;
	let updateCombatHook: number | undefined;
	let createCombatantHook: number | undefined;
	let deleteCombatantHook: number | undefined;
	let updateCombatantHook: number | undefined;
	let renderSceneNavigationHook: number | undefined;
	let canvasReadyHook: number | undefined;
	let canvasTearDownHook: number | undefined;
	let updateSceneHook: number | undefined;

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

		updateCombatantHook = Hooks.on('updateCombatant', () => {
			updateCurrentCombat();
		});

		renderSceneNavigationHook = Hooks.on('renderSceneNavigation', () => {
			updateCurrentCombat();
		});

		canvasReadyHook = Hooks.on('canvasReady', () => {
			updateCurrentCombat();
		});

		// Clear combat tracker when leaving a scene
		canvasTearDownHook = Hooks.on('canvasTearDown', () => {
			currentCombat = null;
			sceneCombatants = [];
			sceneDeadCombatants = [];
			version++;
		});

		// Update when a scene is activated or viewed
		updateSceneHook = Hooks.on('updateScene', () => {
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
		if (updateCombatantHook !== undefined) Hooks.off('updateCombatant', updateCombatantHook);
		if (renderSceneNavigationHook !== undefined)
			Hooks.off('renderSceneNavigation', renderSceneNavigationHook);
		if (canvasReadyHook !== undefined) Hooks.off('canvasReady', canvasReadyHook);
		if (canvasTearDownHook !== undefined) Hooks.off('canvasTearDown', canvasTearDownHook);
		if (updateSceneHook !== undefined) Hooks.off('updateScene', updateSceneHook);
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
			{#key version}
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
			{/key}
		</header>

		<ol class="nimble-combatants" ondrop={(event) => _onDrop(event)} out:fade={{ delay: 0 }}>
			{#key version}
				{#each sceneCombatants as combatant (combatant._id)}
					{@const CombatantComponent = getCombatantComponent(combatant)}

					<li class="nimble-combatants__item">
						<CombatantComponent
							active={currentCombat?.combatant?.id === combatant.id}
							{combatant}
						/>
					</li>
				{/each}

				{#if sceneDeadCombatants.length > 0}
					<li class="nimble-combatants__dead-divider">
						<span class="nimble-combatants__dead-label">- Dead -</span>
					</li>

					{#each sceneDeadCombatants as combatant (combatant._id)}
						{@const CombatantComponent = getCombatantComponent(combatant)}

						<li class="nimble-combatants__item">
							<CombatantComponent active={false} {combatant} />
						</li>
					{/each}
				{/if}
			{/key}
		</ol>

		{#if game.user!.isGM && sceneCombatants.some((combatant) => combatant.initiative === null)}
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
