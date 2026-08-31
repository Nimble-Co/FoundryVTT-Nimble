<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { DamageNodeProps } from '#types/components/DamageNode.d.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';
	import DamageRoll from './DamageRoll.svelte';

	let { node }: DamageNodeProps = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	// Set before the first await so a double-click cannot roll the damage twice.
	let isRolling = $state(false);

	let damageType = $derived(node.damageType);
	let ignoreArmor = $derived(node.ignoreArmor);
	let roll = $derived(node.roll);
	let outcome = $derived(messageDocument?.system?.isMiss ? 'noDamage' : 'fullDamage');

	// Damage that lands on a later trigger than the activation posts unrolled, so
	// the card offers the roll rather than a total for something that has not
	// happened yet. Everyone else sees nothing until it is rolled: only the
	// message author and the GM can write to a chat message, and a "0 Necrotic"
	// placeholder would read as damage that already resolved.
	let awaitingRoll = $derived(node.deferredRoll === true && !roll?.class);
	let canRollDamage = $derived(messageDocument?.canRollDeferredDamage() === true);

	const rollDamageLabel = localize('NIMBLE.chat.rollDamage');

	async function rollDamage() {
		if (isRolling) return;
		isRolling = true;

		try {
			await messageDocument?.rollDeferredDamage(node.id);
		} catch (_error) {
			ui.notifications?.error(localize('NIMBLE.chat.rollDamageFailed'));
		} finally {
			isRolling = false;
		}
	}
</script>

{#if !awaitingRoll}
	<DamageRoll {damageType} {ignoreArmor} {outcome} {roll} />
{:else if canRollDamage}
	<button
		class="nimble-button nimble-button--roll-damage"
		type="button"
		data-button-variant="card-action"
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

<style lang="scss">
	.nimble-button--roll-damage {
		--nimble-card-action-color: var(--color-level-error, #7a1e1e);
	}
</style>
