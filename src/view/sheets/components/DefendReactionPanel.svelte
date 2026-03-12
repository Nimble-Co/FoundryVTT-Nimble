<script>
	import localize from '../../../utils/localize.js';

	let { actor, inCombat = false, actionsRemaining = 0, onDeductAction = async () => {} } = $props();

	let armorValue = $derived(actor.reactive.system.attributes.armor.value ?? 0);

	async function handleDefend() {
		if (!inCombat || actionsRemaining <= 0) return;

		await onDeductAction();

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
				reactionType: 'defend',
				armorValue,
				targets: [],
			},
		};
		await ChatMessage.create(chatData);
	}
</script>

<section class="reaction-card reaction-card--defend">
	<div class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class="fa-solid fa-shield"></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">
				{localize('NIMBLE.ui.heroicActions.reactions.defend.title')}
			</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i> 1 Action
			</span>
		</div>
		<div class="reaction-card__badge">
			<i class="fa-solid fa-shield"></i>
			Armor {armorValue}
		</div>
	</div>

	<p class="reaction-card__description">
		Reduce damage from any single attack by your <strong>Armor ({armorValue})</strong>. Some damage
		like psychic or certain area effects may not be avoidable.
	</p>

	<button
		class="reaction-card__button"
		disabled={!inCombat || actionsRemaining <= 0}
		onclick={handleDefend}
	>
		<i class="fa-solid fa-shield"></i>
		Defend
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
			background: linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(210, 60%, 40%) 100%);
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
			color: hsl(210, 70%, 30%);
			background: hsl(210, 60%, 92%);
			border-radius: 6px;

			i {
				font-size: 0.75rem;
			}
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			line-height: 1.5;

			strong {
				color: hsl(210, 60%, 45%);
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
			background: linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(210, 60%, 40%) 100%);
			border: none;
			border-radius: 6px;
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover:not(:disabled) {
				background: linear-gradient(135deg, hsl(210, 60%, 55%) 0%, hsl(210, 60%, 45%) 100%);
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

	:global(.theme-dark) .reaction-card__badge {
		color: hsl(210, 80%, 75%);
		background: hsl(210, 50%, 25%);
	}

	:global(.theme-dark) .reaction-card__description strong {
		color: hsl(210, 70%, 65%);
	}
</style>
