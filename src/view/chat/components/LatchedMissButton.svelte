<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import { LATCHED_DAMAGE_FLAG } from '#documents/chatMessage.ts';
	import { SYSTEM_ID } from '#system';
	import { latchedCreatureOf } from '#utils/damage/hitCondition.ts';
	import localize from '#utils/localize.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	const held = $derived.by(() => {
		const uuids: string[] = messageDocument?.reactive?.system?.targets ?? [];
		for (const uuid of uuids) {
			const target = (fromUuidSync(uuid) as { actor?: never } | null)?.actor;
			const creature = latchedCreatureOf(target);
			if (creature) return creature;
		}
		return null;
	});
	const applied = $derived(
		(messageDocument?.reactive?.flags as Record<string, Record<string, unknown>>)?.[SYSTEM_ID]?.[
			LATCHED_DAMAGE_FLAG
		] === true,
	);
	const amount = $derived(
		held && messageDocument?.reactive?.system?.isMiss === true && !applied
			? (messageDocument.latchedMissDamage(held.uuid) ?? null)
			: null,
	);
</script>

{#if held && amount !== null}
	<button
		class="nimble-button"
		data-button-variant="card-action"
		style="--nimble-card-action-color: currentColor"
		type="button"
		onclick={() => messageDocument?.applyLatchedMissDamage(held.uuid)}
	>
		{localize('NIMBLE.chat.applyLatchedDamage', { amount: String(amount), name: held.name })}
	</button>
{/if}
