<script lang="ts">
	import { getContext } from 'svelte';
	import prepareRollTooltip from '../../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';
	import type { NimbleChatMessage } from '../../../documents/chatMessage.js';

	interface AppliedHealingRecord {
		effectId: string;
		healingType: string;
		amount: number;
		targets: Array<{
			uuid: string;
			tokenName: string;
			previousHp: number;
			previousTempHp: number;
			newHp: number;
			newTempHp: number;
		}>;
		appliedAt: number;
	}

	const messageDocument = getContext('messageDocument') as NimbleChatMessage;
	const { actorType, permissions } = messageDocument.system as {
		actorType: string;
		permissions: unknown;
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

	<h3 class="roll__label">Healing</h3>

	{#if secondaryInfo}
		<span class="roll__mode">
			{secondaryInfo}
		</span>
	{/if}
</div>

<div class="healing-actions">
	{#if isApplied}
		<div class="healing-applied">
			<div class="healing-applied__status">
				<svg
					class="healing-applied__icon"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
						clip-rule="evenodd"
					/>
				</svg>
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
			class="nimble-button nimble-button--undo"
			aria-label={localize('undoHealing')}
			data-tooltip={localize('undoHealing')}
			data-tooltip-direction="UP"
			onclick={handleUndoHealing}
		>
			<svg class="nimble-button__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z"
					clip-rule="evenodd"
				/>
			</svg>
			{localize('undo')}
		</button>
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
			<svg class="nimble-button__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001l-.002-.001z"
				/>
			</svg>
			{localize('applyHealing')}
		</button>
	{/if}
</div>

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
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		background-color: color-mix(in srgb, var(--healing-success-color) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--healing-success-color) 40%, transparent);
		border-radius: 4px;

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

		&__icon {
			width: 0.875rem;
			height: 0.875rem;
			flex-shrink: 0;
		}

		&--apply-healing {
			--healing-button-color: var(--color-level-success, #18520b);

			color: var(--healing-button-color);
			border-color: color-mix(in srgb, var(--healing-button-color) 50%, transparent);

			&:hover:not(:disabled) {
				background-color: color-mix(in srgb, var(--healing-button-color) 12%, transparent);
				border-color: var(--healing-button-color);
			}
		}

		&--disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&--undo {
			color: var(--nimble-medium-text-color);

			&:hover {
				color: var(--color-warning, #ffc107);
				border-color: var(--color-warning, #ffc107);
			}
		}
	}
</style>
