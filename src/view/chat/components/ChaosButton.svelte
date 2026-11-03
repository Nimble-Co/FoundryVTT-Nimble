<script lang="ts">
	import { getContext } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import {
		CHAOS_INVOKED_FLAG,
		CHAOS_TICKED_FLAG,
		canInvokeChaos,
	} from '#utils/chaos/invokeChaos.js';
	import { canActOnCard, runCardAction } from '#utils/chat/cardActions.js';
	import localize from '#utils/localize.js';
	import { isRuleAutomationEnabled } from '../../../settings/automationSettings.js';

	interface AttackMessage {
		id?: string | null;
		isAuthor?: boolean;
		speaker?: unknown;
		reactive?: {
			system?: { isCritical?: boolean };
			flags?: Record<string, Record<string, unknown>>;
		};
	}

	let busy = $state(false);

	const message = getContext<AttackMessage | undefined>('messageDocument');
	const actor = () =>
		(message ? ChatMessage.getSpeakerActor(message.speaker as never) : null) as never;
	const shows = $derived(
		!!message &&
			!isRuleAutomationEnabled() &&
			(!!message.reactive?.flags?.[SYSTEM_ID]?.[CHAOS_TICKED_FLAG] ||
				(message.reactive?.system?.isCritical === true && canInvokeChaos(actor()))) &&
			!message.reactive?.flags?.[SYSTEM_ID]?.[CHAOS_INVOKED_FLAG] &&
			canActOnCard(message, actor()),
	);

	async function use() {
		if (busy || !message) return;
		busy = true;
		try {
			await runCardAction(message as never, { name: 'chaosInvoke' });
		} finally {
			busy = false;
		}
	}
</script>

{#if shows}
	<button type="button" disabled={busy} onclick={use}>
		{localize('NIMBLE.chat.chaos.rollButton')}
	</button>
{/if}
