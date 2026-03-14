<script>
	import { getRollModeSummary } from '../dataPreparationHelpers/getRollModeSummary.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';
	import localize from '../../utils/localize.js';
	import { createAssessActionCardState, getTargetToken } from './AssessActionCard.svelte.ts';

	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	const { messageDocument } = $props();

	const {
		rolls,
		headerBackgroundColor,
		headerTextColor,
		actorType,
		permissions,
		rollMode,
		optionTitle,
		resultMessage,
		target,
		targetName,
		label,
		resultLabel,
		hintClass,
		hintIcon,
	} = createAssessActionCardState(() => messageDocument);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="check"
>
	<header class="nimble-chat-card__body-header">
		<i class="fa-solid fa-magnifying-glass"></i>
		<span>{optionTitle}</span>
	</header>

	{#if target}
		<div class="assess-action-card__target">
			{#await getTargetToken(target) then tokenDoc}
				{#if tokenDoc}
					<img
						class="assess-action-card__target-img"
						src={tokenDoc.texture?.src || 'icons/svg/mystery-man.svg'}
						alt={targetName}
					/>
				{/if}
			{:catch}
				<!-- Token lookup failed, show fallback image -->
				<img
					class="assess-action-card__target-img"
					src="icons/svg/mystery-man.svg"
					alt={targetName}
				/>
			{/await}
			<span class="assess-action-card__target-label"
				>{localize('NIMBLE.ui.heroicActions.targetLabel')}</span
			>
			<span class="assess-action-card__target-name">{targetName}</span>
		</div>
	{/if}

	<div class="assess-action-card__content">
		{#each rolls as roll}
			<RollSummary
				{label}
				subheading={getRollModeSummary(rollMode)}
				tooltip={prepareRollTooltip(actorType, permissions, roll)}
				total={roll.total}
			/>
		{/each}

		<small class="nimble-hint {hintClass}">
			<i class="nimble-hint__icon {hintIcon}"></i>
			{resultLabel}
		</small>

		<div class="assess-action-card__message">
			{@html resultMessage}
		</div>
	</div>
</article>

<style lang="scss">
	.assess-action-card__target {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border-bottom: 1px solid var(--nimble-card-border-color);
	}

	.assess-action-card__target-img {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 3px;
		object-fit: cover;
		border: 1px solid var(--nimble-card-border-color);
	}

	.assess-action-card__target-label {
		font-size: var(--nimble-xs-text);
		font-weight: 500;
		color: var(--nimble-medium-text-color);
	}

	.assess-action-card__target-name {
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		color: var(--nimble-dark-text-color);
	}

	.assess-action-card__content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.assess-action-card__message {
		font-size: var(--nimble-sm-text);
		color: var(--nimble-dark-text-color);
		line-height: 1.5;

		:global(p) {
			margin: 0;
		}
	}

	.nimble-hint {
		margin-block-end: 0;
	}
</style>
