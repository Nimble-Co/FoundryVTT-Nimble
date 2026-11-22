<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import LinkedText from '../../components/LinkedText.svelte';
	import { useTargetChanges } from '../utils/useTargetChanges.svelte.ts';
	import { ricochetLineOf } from './ricochetLine.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	const targetChanges = useTargetChanges();
	let busy = $state(false);

	function tokenName(tokenUuid: string): string {
		const token = fromUuidSync(tokenUuid as never) as { name?: string } | null;
		return token?.name ?? '';
	}

	const line = $derived.by(() => {
		void targetChanges.version;
		const card = messageDocument?.reactive;
		if (!card) return null;
		const targets = Array.from(game.user?.targets ?? []).map((token) => ({
			uuid: token.document.uuid ?? '',
			name: token.document.name,
		}));
		return ricochetLineOf(card as never, {
			targets,
			isGM: game.user?.isGM === true,
			names: tokenName,
		});
	});

	async function act() {
		const action = line?.action;
		if (!messageDocument || !action || busy) return;
		busy = true;
		try {
			if (action.kind === 'apply')
				await messageDocument.cardRicochet.applyDamage(action.targetUuid);
			else await messageDocument.cardRicochet.setTarget(action.targetUuid);
		} finally {
			busy = false;
		}
	}
</script>

{#if line}
	<section class="nimble-effect nimble-ricochet">
		<p class="nimble-ricochet__text">
			<i class="fa-solid fa-arrows-turn-right" aria-hidden="true"></i>
			<span><LinkedText parts={line.parts} /></span>
		</p>
		{#if line.action}
			<button
				class="nimble-button"
				data-button-variant="card-action"
				style="--nimble-card-action-color: currentColor"
				type="button"
				disabled={busy}
				onclick={act}
			>
				{line.action.label}
			</button>
		{/if}
		{#if line.note}
			<p class="nimble-ricochet__note">{line.note}</p>
		{/if}
	</section>
{/if}

<style lang="scss">
	.nimble-ricochet {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;

		&__text {
			display: flex;
			align-items: baseline;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
		}

		&__note {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}
	}
</style>
