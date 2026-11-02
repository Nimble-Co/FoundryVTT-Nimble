<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import { latchedCreatureOf } from '#utils/damage/hitCondition.ts';
	import localize from '#utils/localize.ts';

	let { amount }: { amount: number } = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');
	const FLAG = 'latchedDamageApplied';

	const held = $derived.by(() => {
		const uuids: string[] = messageDocument?.reactive?.system?.targets ?? [];
		for (const uuid of uuids) {
			const target = (fromUuidSync(uuid as never) as { actor?: never } | null)?.actor;
			const creature = latchedCreatureOf(target);
			if (creature) return creature;
		}
		return null;
	});
	const applied = $derived(
		(messageDocument?.reactive?.flags as Record<string, Record<string, unknown>>)?.[SYSTEM_ID]?.[
			FLAG
		] === true,
	);
	const show = $derived(
		game.user?.isGM && messageDocument?.reactive?.system?.isMiss === true && !!held && !applied,
	);

	async function apply() {
		if (!held) return;
		const creature = (await fromUuid(held.uuid as never)) as {
			applyDamage?(value: number): Promise<void>;
		} | null;
		await creature?.applyDamage?.(amount);
		await messageDocument?.setFlag(SYSTEM_ID as never, FLAG as never, true as never);
	}
</script>

{#if show && held}
	<button
		class="nimble-button"
		data-button-variant="card-action"
		style="--nimble-card-action-color: currentColor"
		type="button"
		onclick={apply}
	>
		{localize('NIMBLE.chat.applyLatchedDamage', { amount: String(amount), name: held.name })}
	</button>
{/if}
