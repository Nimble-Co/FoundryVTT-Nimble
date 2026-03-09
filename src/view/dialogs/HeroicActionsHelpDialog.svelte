<script>
	import localize from '../../utils/localize.js';

	const HEROIC_ACTIONS = [
		{
			id: 'attack',
			icon: 'fa-solid fa-sword',
			titleKey: 'NIMBLE.ui.heroicActions.help.actions.attack.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.actions.attack.description',
		},
		{
			id: 'spell',
			icon: 'fa-solid fa-wand-sparkles',
			titleKey: 'NIMBLE.ui.heroicActions.help.actions.spell.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.actions.spell.description',
		},
		{
			id: 'move',
			icon: 'fa-solid fa-person-running',
			titleKey: 'NIMBLE.ui.heroicActions.help.actions.move.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.actions.move.description',
		},
		{
			id: 'assess',
			icon: 'fa-solid fa-eye',
			titleKey: 'NIMBLE.ui.heroicActions.help.actions.assess.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.actions.assess.description',
		},
		{
			id: 'free',
			icon: 'fa-solid fa-bolt',
			titleKey: 'NIMBLE.ui.heroicActions.help.actions.free.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.actions.free.description',
		},
	];

	const HEROIC_REACTIONS = [
		{
			id: 'defend',
			icon: 'fa-solid fa-shield',
			titleKey: 'NIMBLE.ui.heroicActions.help.reactions.defend.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.reactions.defend.description',
		},
		{
			id: 'interpose',
			icon: 'fa-solid fa-people-arrows',
			titleKey: 'NIMBLE.ui.heroicActions.help.reactions.interpose.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.reactions.interpose.description',
		},
		{
			id: 'opportunity',
			icon: 'fa-solid fa-bullseye',
			titleKey: 'NIMBLE.ui.heroicActions.help.reactions.opportunity.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.reactions.opportunity.description',
		},
		{
			id: 'help',
			icon: 'fa-solid fa-handshake-angle',
			titleKey: 'NIMBLE.ui.heroicActions.help.reactions.help.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.help.reactions.help.description',
		},
	];

	let activeTab = $state('actions');
</script>

<article class="nimble-sheet__body help-dialog">
	<div class="help-dialog__tabs">
		<button
			class="help-dialog__tab"
			class:help-dialog__tab--active={activeTab === 'actions'}
			type="button"
			onclick={() => (activeTab = 'actions')}
		>
			<i class="fa-solid fa-bolt"></i>
			{localize('NIMBLE.ui.heroicActions.help.tabs.actions')}
		</button>
		<button
			class="help-dialog__tab"
			class:help-dialog__tab--active={activeTab === 'reactions'}
			type="button"
			onclick={() => (activeTab = 'reactions')}
		>
			<i class="fa-solid fa-reply"></i>
			{localize('NIMBLE.ui.heroicActions.help.tabs.reactions')}
		</button>
	</div>

	{#if activeTab === 'actions'}
		<p class="help-dialog__intro">
			{localize('NIMBLE.ui.heroicActions.help.actions.intro')}
		</p>

		<ul class="help-dialog__list">
			{#each HEROIC_ACTIONS as action (action.id)}
				<li class="help-item">
					<div class="help-item__icon">
						<i class={action.icon}></i>
					</div>
					<div class="help-item__content">
						<h4 class="help-item__title">{localize(action.titleKey)}</h4>
						<p class="help-item__description">{localize(action.descriptionKey)}</p>
					</div>
				</li>
			{/each}
		</ul>

		<p class="help-dialog__footer">
			{localize('NIMBLE.ui.heroicActions.help.actions.footer')}
		</p>
	{:else}
		<p class="help-dialog__intro">
			{localize('NIMBLE.ui.heroicActions.help.reactions.intro')}
		</p>

		<ul class="help-dialog__list">
			{#each HEROIC_REACTIONS as reaction (reaction.id)}
				<li class="help-item">
					<div class="help-item__icon">
						<i class={reaction.icon}></i>
					</div>
					<div class="help-item__content">
						<h4 class="help-item__title">{localize(reaction.titleKey)}</h4>
						<p class="help-item__description">{localize(reaction.descriptionKey)}</p>
					</div>
				</li>
			{/each}
		</ul>

		<p class="help-dialog__footer">
			{localize('NIMBLE.ui.heroicActions.help.reactions.footer')}
		</p>
	{/if}
</article>

<style lang="scss">
	.help-dialog {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;

		&__tabs {
			display: flex;
			gap: 0.25rem;
			padding-bottom: 0.5rem;
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&__tab {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			flex: 1;
			padding: 0.5rem 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			background: var(--nimble-box-background-color);
			border: 2px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.15s ease;
			justify-content: center;

			i {
				font-size: 0.875rem;
			}

			&:hover:not(&--active) {
				border-color: var(--nimble-accent-color);
				color: var(--nimble-dark-text-color);
			}

			&--active {
				color: hsl(45, 60%, 35%);
				background: hsla(45, 60%, 50%, 0.12);
				border-color: hsl(45, 60%, 45%);
			}
		}

		&__intro {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			line-height: 1.5;
		}

		&__list {
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

	.help-item {
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

	:global(.theme-dark) .help-dialog__tab--active {
		color: hsl(45, 70%, 65%);
		background: linear-gradient(135deg, hsla(45, 60%, 50%, 0.2) 0%, hsla(45, 60%, 40%, 0.1) 100%);
		border-color: hsl(45, 70%, 55%);
	}
</style>
