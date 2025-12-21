<script lang="ts">
	import { fade } from 'svelte/transition';
	import { draggable } from '../../../actions/draggable.svelte.js';

	import HitPointBar from '../../sheets/components/HitPointBar.svelte';

	async function deleteCombatant(event: MouseEvent) {
		event.preventDefault();
		// Use combatant.parent to get the correct combat (not game.combat which may be different)
		const parentCombat = combatant.parent as Combat | null;
		const combatantDoc = parentCombat?.combatants?.get(combatant._id);
		if (combatantDoc) {
			await combatantDoc.delete();
		}
	}

	async function panToCombatant(event) {
		event.preventDefault();

		if (!combatant.actor?.testUserPermission(game.user, 'OBSERVER')) return;

		const token = combatant.token?.object;
		token?.control({ releaseOthers: true });

		return canvas.animatePan(token?.center);
	}

	async function toggleCombatantDefeatedState(event) {
		event.preventDefault();

		combatant.update({ defeated: !combatant.defeated });

		const defeatedId = CONFIG.specialStatusEffects.DEFEATED;

		await combatant.actor?.toggleStatusEffect(defeatedId, {
			overlay: true,
			active: !combatant.defeated,
		});
	}

	function toggleCombatantVisibility(event) {
		event.preventDefault();
		combatant.update({ hidden: !combatant.hidden });
	}

	async function openActorSheet(event) {
		event.preventDefault();

		const actor = combatant.actor;

		if (!actor?.testUserPermission(game.user, 'OBSERVER')) return;

		return actor?.sheet.render(true);
	}

	async function handleTokenHighlight(event, mode) {
		event.preventDefault();

		const token = combatant.token?.object;

		if (!token || !token.isVisible || token.controlled) return;

		if (mode === 'enter') {
			token._onHoverIn(event, { hoverOutOthers: true });
		} else {
			token._onHoverOut(event);
		}
	}

	async function pingCombatantToken(event) {
		event.preventDefault();

		if (!canvas?.ready || combatant.sceneId !== canvas?.scene?.id) return;

		const token = combatant.token?.object;

		if (!token?.visible) {
			return ui.notifications.warn(game.i18n.localize('COMBAT.WarnNonVisibleToken'));
		}

		await canvas.ping(token.center);
	}

	// `children` is optional: some combatant rows render no extra controls/content.
	let { active, children = undefined, combatant } = $props();

	let isObserver = combatant?.actor?.testUserPermission(game.user, 'OBSERVER');
</script>

<article
	class="nimble-combatant"
	class:nimble-combatant--active={active}
	data-combatant-id={combatant._id}
	onmouseenter={(event) => handleTokenHighlight(event, 'enter')}
	onmouseleave={(event) => handleTokenHighlight(event, 'leave')}
	use:draggable={JSON.stringify(
		(combatant.parent as Combat | null)?.combatants?.get(combatant._id)?.toDragData() ?? {},
	)}
	in:fade={{ delay: 200 }}
	out:fade={{ delay: 0 }}
>
	<div
		class="nimble-combatant__image-wrapper"
		class:nimble-combatant__image-wrapper--observer={isObserver}
	>
		<img
			class="nimble-combatant__image"
			class:nimble-combatant__image--muted={combatant.reactive?.defeated ||
				combatant.reactive?.hidden}
			src={combatant.reactive?.img ?? 'icons/svg/mystery-man.svg'}
			alt="Combatant art"
		/>

		<div class="nimble-combatant-controls-overlay">
			<div class="nimble-combatant-controls-overlay__column">
				{#if game.user.isGM}
					<button
						class="nimble-combatant-controls-overlay__button"
						class:nimble-combatant-controls-overlay__button--active={combatant.reactive?.hidden}
						type="button"
						aria-label="Toggle combatant visibility"
						data-tooltip="Toggle combatant visibility"
						onclick={toggleCombatantVisibility}
					>
						<i class="nimble-combatant-controls-overlay__button-icon fa-solid fa-eye-slash"></i>
					</button>

					<button
						class="nimble-combatant-controls-overlay__button"
						class:nimble-combatant-controls-overlay__button--active={combatant.reactive?.defeated}
						type="button"
						aria-label="Mark combatant as defeated"
						data-tooltip="Mark combatant as defeated"
						onclick={toggleCombatantDefeatedState}
					>
						<i class="nimble-combatant-controls-overlay__button-icon fa-solid fa-skull"></i>
					</button>

					<button
						class="nimble-combatant-controls-overlay__button"
						type="button"
						aria-label="Delete combatant"
						data-tooltip="Delete combatant"
						onclick={deleteCombatant}
					>
						<i class="nimble-combatant-controls-overlay__button-icon fa-solid fa-trash"></i>
					</button>
				{/if}
			</div>

			<div class="nimble-combatant-controls-overlay__column">
				{#if isObserver}
					<button
						class="nimble-combatant-controls-overlay__button"
						type="button"
						aria-label="Open actor sheet"
						data-tooltip="Open actor sheet"
						onclick={openActorSheet}
					>
						<i class="nimble-combatant-controls-overlay__button-icon fa-solid fa-expand"></i>
					</button>

					<button
						class="nimble-combatant-controls-overlay__button"
						type="button"
						aria-label="Pan to token"
						data-tooltip="Pan to token"
						onclick={panToCombatant}
					>
						<i
							class="nimble-combatant-controls-overlay__button-icon fa-solid fa-magnifying-glass-location"
						></i>
					</button>

					<button
						class="nimble-combatant-controls-overlay__button"
						type="button"
						aria-label="Ping token"
						data-tooltip="Ping token"
						onclick={pingCombatantToken}
					>
						<i class="nimble-combatant-controls-overlay__button-icon fa-solid fa-bullseye"></i>
					</button>
				{/if}
			</div>
		</div>
	</div>

	{#if isObserver && combatant.actor?.reactive?.system?.attributes?.hp}
		{@const currentHP = combatant.actor.reactive.system.attributes.hp.value}
		{@const maxHP = combatant.actor.reactive.system.attributes.hp.max}
		{@const isBloodied = currentHP < maxHP / 2}

		<div class="nimble-combatant__hp-bar-wrapper">
			<HitPointBar
				{currentHP}
				{isBloodied}
				{maxHP}
				compact={true}
				disableControls={true}
				showTempHP={false}
			/>
		</div>
	{/if}

	<header class="nimble-combatant__header">
		<h3
			class="nimble-combatant__heading"
			class:nimble-combatant__heading--defeated={combatant.reactive?.defeated}
		>
			{combatant.token?.actor?.reactive?.name ??
				combatant.token?.reactive?.name ??
				combatant.reactive?.name ??
				combatant.name ??
				'Unknown'}
		</h3>
	</header>

	{@render children?.()}
</article>
