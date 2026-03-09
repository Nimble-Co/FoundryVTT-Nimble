<script>
	import localize from '../../utils/localize.js';

	const COMBAT_ACTIONS = [
		{
			id: 'attack',
			icon: 'fa-solid fa-sword',
			titleKey: 'NIMBLE.ui.heroicActions.help.attack.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.attack.description',
		},
		{
			id: 'spell',
			icon: 'fa-solid fa-wand-sparkles',
			titleKey: 'NIMBLE.ui.heroicActions.help.spell.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.spell.description',
		},
		{
			id: 'move',
			icon: 'fa-solid fa-person-running',
			titleKey: 'NIMBLE.ui.heroicActions.help.move.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.move.description',
		},
		{
			id: 'assess',
			icon: 'fa-solid fa-eye',
			titleKey: 'NIMBLE.ui.heroicActions.help.assess.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.assess.description',
		},
		{
			id: 'other',
			icon: 'fa-solid fa-ellipsis',
			titleKey: 'NIMBLE.ui.heroicActions.help.other.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.other.description',
		},
	];
</script>

<article class="nimble-sheet__body help-dialog">
	<p class="help-dialog__intro">
		{localize('NIMBLE.ui.heroicActions.help.intro')}
	</p>

	<ul class="help-dialog__actions">
		{#each COMBAT_ACTIONS as action (action.id)}
			<li class="help-action">
				<div class="help-action__icon">
					<i class={action.icon}></i>
				</div>
				<div class="help-action__content">
					<h4 class="help-action__title">{localize(action.titleKey)}</h4>
					<p class="help-action__description">{localize(action.descriptionKey)}</p>
				</div>
			</li>
		{/each}
	</ul>

	<p class="help-dialog__footer">
		{localize('NIMBLE.ui.heroicActions.help.footer')}
	</p>
</article>

<style lang="scss">
	.help-dialog {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;

		&__intro {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			line-height: 1.5;
		}

		&__actions {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__footer {
			margin: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			line-height: 1.5;
			font-style: italic;
		}
	}

	.help-action {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 4px;
			flex-shrink: 0;

			i {
				font-size: 0.875rem;
				color: var(--nimble-medium-text-color);
			}
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__title {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.3;
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			line-height: 1.4;
		}
	}
</style>
