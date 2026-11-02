<script lang="ts">
	import { getContext } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import { canInvokeChaos, invokeChaos } from '#utils/chaos/invokeChaos.js';
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
		setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
	}

	const message = getContext<AttackMessage | undefined>('messageDocument');
	const actor = () =>
		(message ? ChatMessage.getSpeakerActor(message.speaker as never) : null) as never;
	const shows = $derived(
		!!message &&
			!isRuleAutomationEnabled() &&
			message.reactive?.system?.isCritical === true &&
			!message.reactive?.flags?.[SYSTEM_ID]?.chaosInvoked &&
			(game.user?.isGM === true || message.isAuthor === true) &&
			canInvokeChaos(actor()),
	);
	let busy = $state(false);

	async function use() {
		if (busy || !message) return;
		busy = true;
		try {
			await message.setFlag(SYSTEM_ID, 'chaosInvoked', true);
			await invokeChaos(actor(), message.id ?? null);
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
