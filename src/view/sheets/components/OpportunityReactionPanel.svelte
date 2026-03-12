<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';
	import { createOpportunityPanelState } from './OpportunityReactionPanel.svelte.ts';

	const sheet = getContext('application');

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
		showEmbeddedDocumentImages = true,
	} = $props();

	const state = createOpportunityPanelState(
		() => actor,
		() => onDeductAction,
	);

	let targetingVersion = $state(0);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(actor.id ?? '');
	});

	const selectedTarget = $derived(availableTargets.length === 1 ? availableTargets[0] : null);

	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	let isDisabled = $derived(!inCombat || actionsRemaining <= 0);
</script>

<section class="reaction-card reaction-card--opportunity">
	<div class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class="fa-solid fa-bullseye"></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">
				{localize('NIMBLE.ui.heroicActions.reactions.opportunity.title')}
			</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i> 1 Action
			</span>
		</div>
		<div class="reaction-card__badge reaction-card__badge--warning">
			<i class="fa-solid fa-dice"></i>
			Disadvantage
		</div>
	</div>

	<p class="reaction-card__description">
		Strike an adjacent enemy as they willingly move away. Only heroes can make opportunity attacks.
	</p>

	<div class="reaction-card__target-section">
		<span class="reaction-card__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			Target
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-card__no-target">
				<span>Target an enemy token (optional)</span>
			</div>
		{:else if availableTargets.length === 1}
			<div class="reaction-card__target">
				<img
					class="reaction-card__target-img"
					src={selectedTarget?.document?.texture?.src || 'icons/svg/mystery-man.svg'}
					alt={getTargetName(selectedTarget)}
				/>
				<span class="reaction-card__target-name">{getTargetName(selectedTarget)}</span>
				<i class="fa-solid fa-check reaction-card__target-check"></i>
			</div>
		{:else}
			<div class="reaction-card__no-target reaction-card__no-target--warning">
				<i class="fa-solid fa-triangle-exclamation"></i>
				<span>Multiple targets selected</span>
			</div>
		{/if}
	</div>

	<div class="reaction-card__weapons">
		{#if state.showUnarmedStrike}
			<button
				class="weapon-option"
				class:weapon-option--disabled={isDisabled}
				disabled={isDisabled}
				onclick={() => state.handleUnarmedStrike()}
			>
				<div class="weapon-option__icon">
					<i class="fa-solid fa-hand-fist"></i>
				</div>
				<span class="weapon-option__name">Unarmed Strike</span>
				<span class="weapon-option__damage">
					<i class="fa-solid fa-burst"></i>
					{state.getUnarmedDamageDisplay()}
				</span>
			</button>
		{/if}

		{#each state.sortItems(state.meleeWeapons) as item (item._id)}
			{@const damage = state.getWeaponDamage(item)}
			<button
				class="weapon-option"
				class:weapon-option--disabled={isDisabled}
				disabled={isDisabled}
				data-item-id={item._id}
				draggable="true"
				ondragstart={(event) => sheet._onDragStart(event)}
				onclick={() => state.handleItemClick(item._id)}
			>
				{#if showEmbeddedDocumentImages}
					<img class="weapon-option__img" src={item.reactive.img} alt={item.reactive.name} />
				{:else}
					<div class="weapon-option__icon">
						<i class="fa-solid fa-sword"></i>
					</div>
				{/if}
				<span class="weapon-option__name">{item.reactive.name}</span>
				{#if damage}
					<span class="weapon-option__damage">
						<i class="fa-solid fa-burst"></i>
						{damage}
					</span>
				{/if}
			</button>
		{/each}

		{#if !state.showUnarmedStrike && state.meleeWeapons.length === 0}
			<p class="reaction-card__empty">No melee weapons available</p>
		{/if}
	</div>
</section>

<style lang="scss">
	.reaction-card {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 8px;

		&__header {
			display: flex;
			align-items: center;
			gap: 0.625rem;
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			background: linear-gradient(135deg, hsl(15, 70%, 50%) 0%, hsl(15, 70%, 40%) 100%);
			border-radius: 6px;
			flex-shrink: 0;

			i {
				font-size: 1.125rem;
				color: white;
			}
		}

		&__title-group {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
		}

		&__title {
			margin: 0;
			font-size: var(--nimble-base-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__cost {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);

			i {
				font-size: 0.625rem;
			}
		}

		&__badge {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.375rem 0.625rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			border-radius: 6px;

			i {
				font-size: 0.75rem;
			}

			&--warning {
				color: hsl(25, 75%, 25%);
				background: hsl(35, 80%, 90%);
			}
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			line-height: 1.5;
		}

		&__target-section {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__target-label {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.03em;

			i {
				font-size: 0.75rem;
			}
		}

		&__target {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			background: hsl(15, 70%, 95%);
			border: 2px solid hsl(15, 60%, 70%);
			border-radius: 6px;
		}

		&__target-img {
			width: 1.75rem;
			height: 1.75rem;
			border-radius: 4px;
			object-fit: cover;
			border: 1px solid hsl(15, 50%, 60%);
		}

		&__target-name {
			flex: 1;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__target-check {
			color: hsl(145, 55%, 40%);
			font-size: 0.875rem;
		}

		&__no-target {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			background: var(--nimble-box-background-color);
			border: 1px dashed var(--nimble-card-border-color);
			border-radius: 6px;

			&--warning {
				color: hsl(25, 75%, 25%);
				background: hsl(35, 80%, 90%);
				border: 1px solid hsl(35, 70%, 70%);
			}
		}

		&__weapons {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			max-height: 180px;
			overflow-y: auto;
		}

		&__empty {
			margin: 0;
			padding: 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			text-align: center;
			color: var(--nimble-medium-text-color);
		}
	}

	.weapon-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-basic-button-background-color);
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;

		&:hover:not(:disabled) {
			background: hsla(15, 70%, 50%, 0.1);
			border-color: hsla(15, 70%, 50%, 0.3);
		}

		&--disabled,
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.75rem;
			height: 1.75rem;
			background: var(--nimble-box-background-color);
			border-radius: 4px;
			flex-shrink: 0;

			i {
				font-size: 0.875rem;
				color: var(--nimble-medium-text-color);
			}
		}

		&__img {
			width: 1.75rem;
			height: 1.75rem;
			object-fit: cover;
			border-radius: 4px;
			flex-shrink: 0;
		}

		&__name {
			flex: 1;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__damage {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border-radius: 4px;

			i {
				font-size: 0.625rem;
				color: hsl(0, 60%, 50%);
			}
		}
	}

	:global(.theme-dark) .reaction-card {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 28%);
	}

	:global(.theme-dark) .reaction-card__badge--warning {
		color: hsl(40, 90%, 75%);
		background: hsl(30, 60%, 22%);
	}

	:global(.theme-dark) .reaction-card__target {
		background: hsl(15, 50%, 22%);
		border-color: hsl(15, 60%, 45%);
	}

	:global(.theme-dark) .reaction-card__target-check {
		color: hsl(145, 55%, 55%);
	}

	:global(.theme-dark) .reaction-card__no-target--warning {
		color: hsl(40, 90%, 75%);
		background: hsl(30, 60%, 22%);
		border-color: hsl(35, 60%, 35%);
	}

	:global(.theme-dark) .weapon-option:hover:not(:disabled) {
		background: hsla(15, 70%, 50%, 0.15);
		border-color: hsla(15, 70%, 50%, 0.4);
	}
</style>
