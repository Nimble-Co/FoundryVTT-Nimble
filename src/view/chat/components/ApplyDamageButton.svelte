<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { ApplyDamageButtonProps } from '#types/components/ApplyDamageButton.d.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import { useDispositionState } from '../utils/useDispositionState.svelte.ts';

	const { nodes }: ApplyDamageButtonProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	// One click applies every damage packet on the card, so a disposition hint
	// only says something when they all agree on one.
	const targetDisposition = $derived.by(() => {
		const dispositions = new Set(
			nodes.map((node) => node.targetDisposition).filter((disposition) => disposition != null),
		);
		return dispositions.size === 1 ? [...dispositions][0] : undefined;
	});

	const canApplyDamage = $derived.by(() => {
		const canApplyAllDamage = messageDocument?.canApplyAllDamage;
		if (typeof canApplyAllDamage !== 'function') return true;

		return canApplyAllDamage.call(messageDocument);
	});

	const applyDamageLabel = $derived(localize('NIMBLE.chat.applyDamage'));
	const applyDamageTooltip = $derived(
		canApplyDamage ? applyDamageLabel : localize('NIMBLE.chat.noDamageToApply'),
	);

	const { dispositionState } = useDispositionState(
		() => targetDisposition,
		() =>
			(messageDocument?.reactive as unknown as { system?: { targets?: string[] } } | undefined)
				?.system?.targets ?? [],
	);
</script>

<button
	class="nimble-button nimble-button--apply-damage"
	class:nimble-button--recommended={dispositionState === 'recommended'}
	class:nimble-button--discouraged={dispositionState === 'discouraged'}
	aria-label={applyDamageTooltip}
	data-tooltip={applyDamageTooltip}
	data-tooltip-direction="UP"
	disabled={!canApplyDamage}
	onclick={() => messageDocument?.applyAllDamage()}
>
	{applyDamageLabel}
</button>

<style lang="scss">
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
