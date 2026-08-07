<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import DamageRoll from './DamageRoll.svelte';

	let { node } = $props();
	let damageType = $derived(node.damageType);
	let ignoreArmor = $derived(node.ignoreArmor);
	let roll = $derived(node.roll);

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');
	let outcome = $derived(messageDocument?.system?.isMiss ? 'noDamage' : 'fullDamage');

	// Damage that lands on a later trigger than the activation posts unrolled, so
	// the card offers the roll rather than a total for something that has not
	// happened yet. Everyone else sees nothing until it is rolled: only the
	// message author and the GM can write to a chat message, and a "0 Necrotic"
	// placeholder would read as damage that already resolved.
	let awaitingRoll = $derived(node.deferredRoll === true && !roll?.class);
	let canRollDamage = $derived(messageDocument?.canRollDeferredDamage() === true);

	// Set before the first await so a double-click cannot roll the damage twice.
	let isRolling = $state(false);

	const rollDamageLabel = localize('NIMBLE.chat.rollDamage');

	async function rollDamage() {
		if (isRolling) return;
		isRolling = true;

		try {
			await messageDocument?.rollDeferredDamage(node.id);
		} finally {
			isRolling = false;
		}
	}
</script>

{#if awaitingRoll}
	{#if canRollDamage}
		<button
			class="nimble-button nimble-button--roll-damage"
			type="button"
			aria-label={rollDamageLabel}
			data-tooltip={rollDamageLabel}
			data-tooltip-direction="UP"
			disabled={isRolling}
			onclick={rollDamage}
		>
			<i class="fa-solid fa-dice-d20" aria-hidden="true"></i>
			{rollDamageLabel}
		</button>
	{/if}
{:else}
	<DamageRoll {damageType} {ignoreArmor} {outcome} {roll} />
{/if}

<style lang="scss">
	.nimble-button--roll-damage {
		--damage-button-color: var(--color-level-error, #7a1e1e);

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
		color: var(--damage-button-color);
		background-color: transparent;
		border-radius: 4px;
		border: 1px solid color-mix(in srgb, var(--damage-button-color) 50%, transparent);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;

		i {
			display: flex;
			align-items: center;
		}

		&:hover:not(:disabled) {
			background-color: color-mix(in srgb, var(--damage-button-color) 12%, transparent);
			border-color: var(--damage-button-color);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
</style>
