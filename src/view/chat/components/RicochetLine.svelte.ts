import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import { useTargetChanges } from '../utils/useTargetChanges.svelte.ts';
import { ricochetLineOf } from './ricochetLine.ts';

function tokenName(tokenUuid: string): string {
	const token = fromUuidSync(tokenUuid as never) as { name?: string } | null;
	return token?.name ?? '';
}

export function createRicochetLineState(getMessage: () => NimbleChatMessage | undefined) {
	const targetChanges = useTargetChanges();
	let busy = $state(false);

	const line = $derived.by(() => {
		void targetChanges.version;
		const card = getMessage()?.reactive;
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
		const messageDocument = getMessage();
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

	return {
		get line() {
			return line;
		},
		get busy() {
			return busy;
		},
		act,
	};
}
