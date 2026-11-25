<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { ApplyDamageButtonProps } from '#types/components/ApplyDamageButton.d.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import { pendingKeepOf } from '#utils/rolls/cardRollState.ts';
	import { hasDispositionTarget } from '#utils/treeManipulation/hasDispositionTarget.ts';
	import { useDispositionState } from '../utils/useDispositionState.svelte.ts';

	const { nodes = [], packet }: ApplyDamageButtonProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	// Two scopes. Without a packet the button applies the whole card, which is
	// what lets the target's per-attack reductions resolve once. With one it
	// applies just that packet, for damage the card-level pass deliberately
	// leaves out: save-gated damage, whose per-target outcome is not known until
	// each target rolls.
	const targetDisposition = $derived.by(() => {
		const dispositions = new Set(
			nodes.filter(hasDispositionTarget).map((node) => node.targetDisposition),
		);
		return dispositions.size === 1 ? [...dispositions][0] : undefined;
	});

	const canApplyDamage = $derived.by(() => {
		if (packet) {
			const canApplyOne = messageDocument?.canApplyDamage;
			if (typeof canApplyOne !== 'function') return true;
			return canApplyOne.call(messageDocument, packet.total, packet.options);
		}

		const canApplyAllDamage = messageDocument?.canApplyAllDamage;
		if (typeof canApplyAllDamage !== 'function') return true;

		return canApplyAllDamage.call(messageDocument);
	});

	const damageApplied = $derived(
		!packet && messageDocument?.reactive?.isDamageApplied?.() === true,
	);
	const canUndoDamage = $derived(damageApplied && game.user?.isGM === true);

	function applyDamage() {
		if (packet) messageDocument?.applyDamage(packet.total, packet.options);
		else messageDocument?.applyAllDamage();
	}

	function undoDamage() {
		void messageDocument?.undoAppliedDamage();
	}

	// A reroll whose result a player still chooses holds the damage.
	const waitsForKeep = $derived(!!pendingKeepOf(messageDocument?.reactive?.system));
	const applyDamageLabel = $derived.by(() => {
		if (waitsForKeep) return localize('NIMBLE.chat.incomingReactions.keepFirst');
		if (damageApplied) return localize('NIMBLE.chat.damageApplied');
		return localize('NIMBLE.chat.applyDamage');
	});
	const applyDamageTooltip = $derived(
		damageApplied || canApplyDamage || waitsForKeep
			? applyDamageLabel
			: localize('NIMBLE.chat.noDamageToApply'),
	);

	const { dispositionState } = useDispositionState(
		() => targetDisposition,
		() =>
			(messageDocument?.reactive as unknown as { system?: { targets?: string[] } } | undefined)
				?.system?.targets ?? [],
	);
</script>

{#snippet applyButton(disabled: boolean)}
	<button
		class="nimble-button nimble-button--apply-damage"
		class:nimble-button--recommended={dispositionState === 'recommended'}
		class:nimble-button--discouraged={dispositionState === 'discouraged'}
		aria-label={applyDamageTooltip}
		data-tooltip={applyDamageTooltip}
		data-tooltip-direction="UP"
		{disabled}
		onclick={applyDamage}
	>
		{applyDamageLabel}
	</button>
{/snippet}

{#if packet}
	{@render applyButton(!canApplyDamage)}
{:else}
	<div class="nimble-apply-damage">
		{@render applyButton(!canApplyDamage || damageApplied)}
		{#if canUndoDamage}
			<button
				class="nimble-button nimble-apply-damage__undo"
				type="button"
				aria-label={localize('NIMBLE.chat.undoDamage')}
				data-tooltip={localize('NIMBLE.chat.undoDamage')}
				data-tooltip-direction="UP"
				onclick={undoDamage}
			>
				<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
			</button>
		{/if}
	</div>
{/if}

<style lang="scss">
	.nimble-apply-damage {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.5rem;

		.nimble-button--apply-damage {
			flex: 1 1 auto;
			width: auto;
			margin-top: 0;
		}
	}

	.nimble-apply-damage__undo {
		flex: 0 0 auto;
		width: 2.25rem;
		height: 2.25rem;
	}

	.nimble-button--apply-damage {
		--damage-button-color: var(--color-level-error, #7a1e1e);

		display: inline-flex;
		align-items: center;
		justify-content: center;
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
		margin-top: 0.5rem;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;

		&:hover:not(:disabled) {
			background-color: color-mix(in srgb, currentColor 8%, transparent);
		}

		&.nimble-button--recommended {
			color: var(--damage-button-color);
			border-color: color-mix(in srgb, var(--damage-button-color) 50%, transparent);
			border-width: 2px;

			&:hover:not(:disabled) {
				background-color: color-mix(in srgb, var(--damage-button-color) 12%, transparent);
				border-color: var(--damage-button-color);
			}
		}

		&.nimble-button--discouraged {
			opacity: 0.45;

			&:hover:not(:disabled) {
				opacity: 0.65;
			}
		}
	}
</style>
