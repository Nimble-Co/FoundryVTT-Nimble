<script lang="ts">
	import type { RemoveConditionDialogProps } from './RemoveConditionDialog.types.ts';
	import localize from '#utils/localize.js';

	let { dialog, conditionName, conditionImg, usage }: RemoveConditionDialogProps = $props();

	const t = (key: string, data?: Record<string, string>) =>
		localize(`NIMBLE.settings.customConditions.removeDialog.${key}`, data);

	const effectCount = $derived(
		usage.actors.reduce((total, actor) => total + actor.effects.length, 0),
	);
</script>

<article class="nimble-sheet__body nimble-remove-condition">
	<header class="nimble-remove-condition__summary">
		<img class="nimble-remove-condition__icon" src={conditionImg} alt="" />

		<div class="nimble-remove-condition__summary-text">
			<h3 class="nimble-remove-condition__title">{t('title', { name: conditionName })}</h3>
			<p class="nimble-remove-condition__lede">{t('lede')}</p>
		</div>
	</header>

	{#if usage.actors.length > 0}
		<section class="nimble-remove-condition__group">
			<header class="nimble-remove-condition__group-header">
				<h4 class="nimble-remove-condition__group-title">{t('onCreatures')}</h4>
				<span class="nimble-remove-condition__count">
					{t('effectCount', { count: String(effectCount) })}
				</span>
			</header>

			<ul class="nimble-remove-condition__list">
				{#each usage.actors as actor (actor.uuid)}
					<li class="nimble-remove-condition__row">
						<img class="nimble-remove-condition__row-icon" src={actor.img} alt="" />
						<span class="nimble-remove-condition__row-name">{actor.name}</span>
						<span class="nimble-remove-condition__row-detail">
							{t('effectCount', { count: String(actor.effects.length) })}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if usage.items.length > 0}
		<section class="nimble-remove-condition__group">
			<header class="nimble-remove-condition__group-header">
				<h4 class="nimble-remove-condition__group-title">{t('inItems')}</h4>
				<span class="nimble-remove-condition__count">
					{t('itemCount', { count: String(usage.items.length) })}
				</span>
			</header>

			<ul class="nimble-remove-condition__list">
				{#each usage.items as item (item.uuid)}
					<li class="nimble-remove-condition__row">
						<img class="nimble-remove-condition__row-icon" src={item.img} alt="" />
						<span class="nimble-remove-condition__row-name">
							{item.name}
							{#if item.ownerName}
								<span class="nimble-remove-condition__row-owner">{item.ownerName}</span>
							{/if}
						</span>
						<span class="nimble-remove-condition__row-detail">
							{item.referenceLabels.map((label) => localize(label)).join(', ')}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p class="nimble-remove-condition__note">
		<i class="fa-solid fa-circle-info"></i>
		{t('deferredNote')}
	</p>
</article>

<footer class="nimble-sheet__footer nimble-remove-condition__actions">
	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		onclick={() => dialog.close()}
	>
		{t('cancel')}
	</button>

	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		data-tooltip={t('keepReferencesHint')}
		onclick={() => dialog.submit({ choice: 'keep' })}
	>
		{t('keepReferences')}
	</button>

	<button
		class="nimble-button nimble-remove-condition__confirm"
		data-button-variant="basic"
		type="button"
		data-tooltip={t('cleanReferencesHint')}
		onclick={() => dialog.submit({ choice: 'clean' })}
	>
		<i class="fa-solid fa-broom-wide"></i>
		{t('cleanReferences')}
	</button>
</footer>

<style lang="scss">
	.nimble-remove-condition {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		&__summary {
			display: flex;
			align-items: flex-start;
			gap: 0.625rem;
		}

		&__icon {
			flex: 0 0 auto;
			width: 2.5rem;
			height: 2.5rem;
			padding: 0.25rem;
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
		}

		&__summary-text {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		&__title {
			margin: 0;
			font-size: var(--nimble-base-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__lede {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.4;
			color: var(--nimble-medium-text-color);
		}

		&__group {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__group-header {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.5rem;
			padding-block-end: 0.25rem;
			border-block-end: 1px solid var(--nimble-card-border-color);
		}

		&__group-title {
			margin: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--nimble-medium-text-color);
		}

		&__count {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			max-height: 11rem;
			overflow-y: auto;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__row {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.5rem;
			padding: 0.375rem 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__row-icon {
			flex: 0 0 auto;
			width: 1.5rem;
			height: 1.5rem;
			border: none;
			border-radius: 3px;
		}

		&__row-name {
			display: flex;
			flex-direction: column;
			min-width: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			overflow-wrap: anywhere;
		}

		&__row-owner {
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}

		&__row-detail {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			text-align: end;
			white-space: nowrap;
		}

		&__note {
			display: flex;
			align-items: flex-start;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.4;
			color: var(--nimble-medium-text-color);
		}

		&__actions {
			display: grid;
			grid-template-columns: auto 1fr 1fr;
			gap: 0.5rem;
		}

		&__confirm {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.375rem;
			color: var(--nimble-validation-error-color);
			border-color: var(--nimble-validation-error-border-color);
		}
	}
</style>
