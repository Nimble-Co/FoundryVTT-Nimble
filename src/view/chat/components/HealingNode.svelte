<script lang="ts">
	import { getContext } from 'svelte';
	import prepareRollTooltip from '../../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';
	import type { NimbleChatMessage, AppliedHealingRecord } from '../../../documents/chatMessage.js';

	const messageDocument = getContext('messageDocument') as NimbleChatMessage;
	const { actorType, permissions } = messageDocument.system as {
		actorType?: string;
		permissions?: unknown;
	};
	const { healingTypes } = CONFIG.NIMBLE;

	let { node } = $props();

	let healingType = $derived(node.healingType);
	let roll = $derived(node.roll);
	let effectId = $derived(node.id);
	let secondaryInfo = $derived(healingType === 'tempHealing' ? healingTypes[healingType] : null);

	// Access reactive system data directly for proper Svelte 5 reactivity
	let systemData = $derived(
		messageDocument.reactive.system as {
			appliedHealing?: Record<string, AppliedHealingRecord>;
			targets?: string[];
		},
	);
	let appliedHealingData = $derived(systemData.appliedHealing);
	let isApplied = $derived(!!appliedHealingData?.[effectId]);
	let healingRecord = $derived(appliedHealingData?.[effectId]);
	let hasTargets = $derived((systemData.targets?.length ?? 0) > 0);

	// Permission check - only GM or the message author can interact with healing buttons
	let canInteract = $derived(game.user?.isGM || messageDocument.author?.id === game.user?.id);

	// Localization
	const localize = (key: string) => game.i18n.localize(`NIMBLE.chat.${key}`);

	function handleApplyHealing() {
		messageDocument?.applyHealing(roll.total, healingType, effectId);
	}

	function handleUndoHealing() {
		messageDocument?.undoHealing(effectId);
	}
</script>

<div class="roll" class:roll--no-roll-mode={!secondaryInfo}>
	<div
		class="roll__total"
		data-tooltip={prepareRollTooltip(actorType, permissions, Roll.fromData(roll))}
		data-tooltip-class="nimble-tooltip nimble-tooltip--roll"
		data-tooltip-direction="LEFT"
	>
		{roll.total}
	</div>

	<h3 class="roll__label">{localize('healing')}</h3>

	{#if secondaryInfo}
		<span class="roll__mode">
			{secondaryInfo}
		</span>
	{/if}
</div>

{#if canInteract}
	<div class="healing-actions">
		{#if isApplied}
			<div class="healing-applied">
				<div class="healing-applied__content">
					<div class="healing-applied__status">
						<i class="fa-solid fa-check healing-applied__icon" aria-hidden="true"></i>
						<span class="healing-applied__text">{localize('healingApplied')}</span>
					</div>
					{#if healingRecord?.targets?.length}
						<div class="healing-applied__targets">
							{#each healingRecord.targets as target}
								<span class="healing-applied__target">
									{target.tokenName}: {target.previousHp} → {target.newHp} HP
								</span>
							{/each}
						</div>
					{/if}
				</div>
				<button
					class="healing-applied__undo"
					aria-label={localize('undoHealing')}
					data-tooltip={localize('undoHealing')}
					data-tooltip-direction="UP"
					onclick={handleUndoHealing}
				>
					<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
				</button>
			</div>
		{:else}
			<button
				class="nimble-button nimble-button--apply-healing"
				class:nimble-button--disabled={!hasTargets}
				aria-label={hasTargets ? localize('applyHealing') : localize('noTargetsSelected')}
				data-tooltip={hasTargets ? localize('applyHealing') : localize('noTargetsSelected')}
				data-tooltip-direction="UP"
				onclick={handleApplyHealing}
				disabled={!hasTargets}
			>
				<i class="fa-solid fa-heart" aria-hidden="true"></i>
				{localize('applyHealing')}
			</button>
		{/if}
	</div>
{/if}

<style lang="scss">
	.roll {
		display: grid;
		grid-template-areas:
			'rollResult rollLabel editButton'
			'rollResult rollMode editButton';
		grid-template-columns: max-content 1fr max-content;
		gap: 0 0.5rem;

		&--no-roll-mode {
			grid-template-areas: 'rollResult rollLabel editButton';
		}

		&__label {
			grid-area: rollLabel;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin: 0;
			color: inherit;
			font-size: var(--nimble-sm-text);
			line-height: 1;
			font-weight: 900;
			border: 0;
		}

		&__mode {
			grid-area: rollMode;
			width: 100%;
			font-size: var(--nimble-xs-text);
			line-height: 1;
			color: var(--nimble-medium-text-color);
			font-weight: 500;
		}

		&__total {
			grid-area: rollResult;
			position: relative;
			display: flex;
			flex-grow: 0;
			align-items: center;
			justify-content: center;
			height: 2.25rem;
			width: 2.5rem;
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}
	}

	.healing-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.healing-applied {
		--healing-success-color: var(--color-level-success, #18520b);

		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background-color: color-mix(in srgb, var(--healing-success-color) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--healing-success-color) 40%, transparent);
		border-radius: 4px;

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			flex: 1;
			min-width: 0;
		}

		&__status {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			font-weight: 600;
			font-size: var(--nimble-sm-text);
			color: var(--healing-success-color);
		}

		&__icon {
			width: 1rem;
			height: 1rem;
			flex-shrink: 0;
		}

		&__text {
			line-height: 1;
		}

		&__targets {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			padding-left: 1.375rem;
		}

		&__target {
			font-size: var(--nimble-xs-text);
			color: inherit;
		}

		&__undo {
			display: flex;
			align-items: center;
			justify-content: center;
			align-self: center;
			width: 1.75rem;
			height: 1.75rem;
			flex-shrink: 0;
			padding: 0;
			background-color: var(--nimble-basic-button-background-color);
			border: 1px solid color-mix(in srgb, var(--nimble-dark-text-color) 50%, transparent);
			border-radius: 4px;
			color: var(--nimble-dark-text-color);
			cursor: pointer;
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease,
				color 0.15s ease,
				filter 0.15s ease;

			i {
				font-size: 0.75rem;
			}

			&:hover {
				color: var(--nimble-dark-text-hover-color);
				border-color: var(--nimble-dark-text-hover-color);
				background-color: var(--nimble-basic-button-background-color);
				filter: brightness(1.1);
			}
		}
	}

	.nimble-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		width: 100%;
		height: 2.25rem;
		padding: 0 0.625rem;
		font-size: var(--nimble-sm-text);
		font-weight: 900;
		line-height: 1;
		color: inherit;
		background-color: transparent;
		border-radius: 4px;
		border: 1px solid var(--nimble-card-border-color);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;

		&:hover {
			background-color: color-mix(in srgb, currentColor 8%, transparent);
		}

		&--apply-healing {
			--healing-button-color: var(--color-level-success, #18520b);

			color: var(--healing-button-color);
			border-color: color-mix(in srgb, var(--healing-button-color) 50%, transparent);

			i {
				display: flex;
				align-items: center;
			}

			&:hover:not(:disabled) {
				background-color: color-mix(in srgb, var(--healing-button-color) 12%, transparent);
				border-color: var(--healing-button-color);
			}
		}

		&--disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
</style>
