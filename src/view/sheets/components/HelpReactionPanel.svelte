<script>
	import localize from '../../../utils/localize.js';
	import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

	let { actor, inCombat = false, actionsRemaining = 0, onDeductAction = async () => {} } = $props();

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

	async function handleHelp() {
		if (!inCombat || actionsRemaining <= 0) return;

		await onDeductAction();

		// Collect target UUIDs for the chat card
		const targetUuids = availableTargets.map((t) => t.document.uuid);

		const chatData = {
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor }),
			type: 'reaction',
			system: {
				actorName: actor.name,
				actorType: actor.type,
				image: actor.img,
				permissions: actor.permission,
				rollMode: 0,
				reactionType: 'help',
				targets: targetUuids,
			},
		};
		await ChatMessage.create(chatData);
	}
</script>

<section class="reaction-card reaction-card--help">
	<div class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class="fa-solid fa-handshake-angle"></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">
				{localize('NIMBLE.ui.heroicActions.reactions.help.title')}
			</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i> 1 Action
			</span>
		</div>
		<div class="reaction-card__badge reaction-card__badge--success">
			<i class="fa-solid fa-dice-d20"></i>
			Advantage
		</div>
	</div>

	<p class="reaction-card__description">
		Grant an ally <strong>advantage</strong> on a roll by explaining how you help. The GM may require
		a skill check. Limited to one Help per roll.
	</p>

	<div class="reaction-card__target-section">
		<span class="reaction-card__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			Helping
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-card__no-target">
				<span>Target an ally token (optional)</span>
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
				<span>Select only one target</span>
			</div>
		{/if}
	</div>

	<p class="reaction-card__tip">
		<i class="fa-solid fa-lightbulb"></i>
		Think fast when an ally fails! A creative explanation might turn failure into success.
	</p>

	<button
		class="reaction-card__button"
		disabled={!inCombat || actionsRemaining <= 0}
		onclick={handleHelp}
	>
		<i class="fa-solid fa-handshake-angle"></i>
		Help an Ally
	</button>
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
			background: linear-gradient(135deg, hsl(145, 55%, 45%) 0%, hsl(145, 55%, 35%) 100%);
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

			&--success {
				color: hsl(145, 60%, 25%);
				background: hsl(145, 55%, 90%);
			}
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			line-height: 1.5;

			strong {
				color: hsl(145, 55%, 35%);
			}
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
			background: hsl(145, 50%, 95%);
			border: 2px solid hsl(145, 50%, 70%);
			border-radius: 6px;
		}

		&__target-img {
			width: 1.75rem;
			height: 1.75rem;
			border-radius: 4px;
			object-fit: cover;
			border: 1px solid hsl(145, 40%, 60%);
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

		&__tip {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin: 0;
			padding: 0.5rem 0.625rem;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			background: var(--nimble-hint-background-color);
			border-radius: 6px;
			line-height: 1.4;

			i {
				color: hsl(45, 70%, 50%);
				flex-shrink: 0;
			}
		}

		&__button {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 0.625rem 1rem;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: white;
			background: linear-gradient(135deg, hsl(145, 55%, 45%) 0%, hsl(145, 55%, 35%) 100%);
			border: none;
			border-radius: 6px;
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover:not(:disabled) {
				background: linear-gradient(135deg, hsl(145, 55%, 50%) 0%, hsl(145, 55%, 40%) 100%);
				transform: translateY(-1px);
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			i {
				font-size: 0.875rem;
			}
		}
	}

	:global(.theme-dark) .reaction-card {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 28%);
	}

	:global(.theme-dark) .reaction-card__badge--success {
		color: hsl(145, 70%, 70%);
		background: hsl(145, 45%, 22%);
	}

	:global(.theme-dark) .reaction-card__description strong {
		color: hsl(145, 55%, 60%);
	}

	:global(.theme-dark) .reaction-card__target {
		background: hsl(145, 40%, 22%);
		border-color: hsl(145, 50%, 45%);
	}

	:global(.theme-dark) .reaction-card__target-check {
		color: hsl(145, 55%, 55%);
	}

	:global(.theme-dark) .reaction-card__no-target--warning {
		color: hsl(40, 90%, 75%);
		background: hsl(30, 60%, 22%);
		border-color: hsl(35, 60%, 35%);
	}
</style>
