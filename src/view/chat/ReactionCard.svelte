<script lang="ts">
	import type { ReactionCardProps } from '../../../types/components/ReactionCard.d.ts';
	import { setContext, untrack } from 'svelte';
	import localize from '../../utils/localize.js';
	import CardHeader from './components/CardHeader.svelte';
	import Targets from './components/Targets.svelte';
	import { createReactionCardState } from './ReactionCardState.svelte.ts';

	const { messageDocument }: ReactionCardProps = $props();

	const state = createReactionCardState(() => messageDocument);

	const headerBackgroundColor = $derived(state.headerBackgroundColor);
	const headerTextColor = $derived(state.headerTextColor);
	const reactionType = $derived(state.reactionType);
	const armorValue = $derived(state.armorValue);
	const weaponName = $derived(state.weaponName);
	const weaponDamage = $derived(state.weaponDamage);
	const chatMessage = $derived(state.chatMessage);
	const reactionConfig = $derived(state.reactionConfig);

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body reaction-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor}; --reaction-hue: {reactionConfig.colorHue};"
	data-card-type="reaction"
	data-reaction-type={reactionType}
>
	<header class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class={reactionConfig.icon}></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">{reactionConfig.title}</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		{#if reactionType === 'defend' && armorValue !== null}
			<div class="reaction-card__badge reaction-card__badge--defend">
				<i class="fa-solid fa-shield"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.defend.armorBadge', { armor: armorValue })}
			</div>
		{:else if reactionType === 'opportunity'}
			<div class="reaction-card__badge reaction-card__badge--warning">
				<i class="fa-solid fa-dice"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.disadvantage')}
			</div>
		{:else if reactionType === 'help'}
			<div class="reaction-card__badge reaction-card__badge--success">
				<i class="fa-solid fa-dice-d20"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.advantage')}
			</div>
		{:else if reactionType === 'interpose'}
			<div class="reaction-card__badge reaction-card__badge--interpose">
				<i class="fa-solid fa-ruler"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.interpose.rangeBadge')}
			</div>
		{/if}
	</header>

	{#if reactionType === 'opportunity' && weaponName}
		<div class="reaction-card__weapon">
			<span class="reaction-card__weapon-label">
				<i class="fa-solid fa-sword"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.weapon')}
			</span>
			<span class="reaction-card__weapon-name">{weaponName}</span>
			{#if weaponDamage}
				<span class="reaction-card__weapon-damage">
					<i class="fa-solid fa-burst"></i>
					{weaponDamage}
				</span>
			{/if}
		</div>
	{/if}

	{#if reactionConfig.showTargets}
		<Targets />
	{/if}

	{#if chatMessage}
		<div class="reaction-card__message">
			{@html chatMessage}
		</div>
	{/if}
</article>

<style lang="scss">
	.reaction-card {
		--reaction-color: hsl(var(--reaction-hue, 210), 60%, 45%);
		--reaction-color-light: hsl(var(--reaction-hue, 210), 60%, 92%);
		--reaction-color-dark: hsl(var(--reaction-hue, 210), 70%, 30%);

		&__header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: var(--nimble-card-section-padding, 0.5rem);
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.875rem;
			height: 1.875rem;
			background: linear-gradient(
				135deg,
				hsl(var(--reaction-hue), 60%, 50%) 0%,
				hsl(var(--reaction-hue), 60%, 40%) 100%
			);
			border-radius: 6px;
			flex-shrink: 0;

			i {
				font-size: 0.875rem;
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

			&--defend {
				color: var(--nimble-reaction-defend-text);
				background: var(--nimble-reaction-defend-light);
			}

			&--warning {
				color: var(--nimble-reaction-opportunity-text);
				background: var(--nimble-reaction-opportunity-accent);
			}

			&--success {
				color: var(--nimble-reaction-help-text);
				background: var(--nimble-reaction-help-light);
			}

			&--interpose {
				color: var(--nimble-reaction-interpose-text);
				background: var(--nimble-reaction-interpose-light);
			}
		}

		&__weapon {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: var(--nimble-card-section-padding, 0.5rem);
			background: var(--nimble-box-background-color);
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&__weapon-label {
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

		&__weapon-name {
			flex: 1;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__weapon-damage {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;

			i {
				font-size: 0.625rem;
				color: hsl(0, 60%, 50%);
			}
		}

		&__message {
			padding: var(--nimble-card-section-padding, 0.5rem);
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
			line-height: 1.5;

			:global(p) {
				margin: 0;
			}
		}
	}
</style>
