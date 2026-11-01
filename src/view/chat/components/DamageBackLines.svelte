<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type {
		DamageBackAction,
		DamageBackRecord,
	} from '#documents/chatMessage/cardDamageBack.ts';

	import { getContext } from 'svelte';
	import { requestDamageBack } from '#utils/incomingReactions/incomingAttackReactions.js';
	import localize from '../../../utils/localize.js';

	const messageDocument = getContext<NimbleChatMessage>('messageDocument');
	const records = $derived(
		(messageDocument.reactive?.system as { damageBack?: DamageBackRecord[] } | undefined)
			?.damageBack ?? [],
	);

	function canUse(record: DamageBackRecord): boolean {
		if (game.user?.isGM) return true;
		const actor = fromUuidSync(record.actorUuid as `Actor.${string}`) as {
			isOwner?: boolean;
		} | null;
		return actor?.isOwner === true;
	}

	function textOf(record: DamageBackRecord): string {
		const amount = String(record.doubled ? record.amount * 2 : record.amount);
		const data = { label: record.label, name: record.attackerName, amount };
		return localize(
			record.dealt ? 'NIMBLE.chat.damageBack.dealt' : 'NIMBLE.chat.damageBack.waiting',
			data,
		);
	}

	const use = (record: DamageBackRecord, action: DamageBackAction) =>
		requestDamageBack(messageDocument.id ?? '', record.id, action);
</script>

{#each records as record (record.id)}
	<div class="nimble-damage-back">
		<p class="nimble-damage-back__line">
			<i class="fa-solid fa-reply" aria-hidden="true"></i>
			{textOf(record)}
		</p>
		{#if canUse(record) && !record.dealt}
			<button class="nimble-button" type="button" onclick={() => use(record, 'deal')}>
				{localize('NIMBLE.chat.damageBack.deal', { amount: String(record.amount) })}
			</button>
		{:else if canUse(record) && record.woundDoubles && !record.doubled}
			<button class="nimble-button" type="button" onclick={() => use(record, 'double')}>
				{localize('NIMBLE.chat.damageBack.double', { amount: String(record.amount) })}
			</button>
		{/if}
	</div>
{/each}

<style lang="scss">
	.nimble-damage-back {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-block-start: 0.375rem;
		font-size: var(--nimble-sm-text);

		&__line {
			margin: 0;
			text-wrap: pretty;

			i {
				margin-inline-end: 0.25rem;
				font-size: 0.75em;
				opacity: 0.7;
			}
		}
	}
</style>
