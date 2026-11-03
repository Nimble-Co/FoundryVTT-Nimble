import { SYSTEM_ID } from '#system';
import type { ChaosCardSystem } from '#types/chaos.d.ts';
import { whisperChaosRollsToGm } from '#utils/chaos/invokeChaos.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { showsChaosTableRolls } from '../settings/chaosTableSettings.js';

const TOLD_FLAG = 'chaosGmTold';

interface ChaosCardLike {
	id?: string | null;
	type?: string;
	system?: Partial<ChaosCardSystem> & { actorName?: string };
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

const told = new Set<string>();

/** With the table secret, the active GM writes the whisper of a finished Chaos card. */
export async function whisperFinishedChaosCard(card: ChaosCardLike): Promise<void> {
	if (card.type !== 'chaos' || card.system?.status !== 'done' || !card.id) return;
	if (!isActiveGM() || showsChaosTableRolls()) return;
	if (told.has(card.id) || card.getFlag(SYSTEM_ID, TOLD_FLAG)) return;
	told.add(card.id);
	await card.setFlag(SYSTEM_ID, TOLD_FLAG, true);

	const rolls = card.system.rolls ?? [];
	const kept = card.system.kept;
	const standing = typeof kept === 'number' ? rolls.slice(kept, kept + 1) : rolls;
	await whisperChaosRollsToGm(card.system.actorName ?? '', standing, card.system.table ?? 'chaos');
}

let registered = false;

export function registerChaosWhisperHooks(): void {
	if (registered) return;
	registered = true;
	const onCard = (card: unknown) => {
		void whisperFinishedChaosCard(card as ChaosCardLike).catch((error) => {
			console.error('Nimble | Could not tell the GM the Chaos Table roll.', error);
		});
	};
	Hooks.on('createChatMessage', onCard);
	Hooks.on('updateChatMessage', onCard);
}
