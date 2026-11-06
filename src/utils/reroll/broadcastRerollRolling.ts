import { onCardNotice, sendCardNotice } from '../chat/cardOperations.js';
import {
	type RollingReroll,
	startRerollRolling,
	stopRerollRolling,
} from './rerollRolling.svelte.js';

const REROLL_ROLLING_TYPE = 'rerollRolling';

function applyRerollRolling(messageId: string, roll: RollingReroll | null): void {
	if (roll) startRerollRolling(messageId, roll);
	else stopRerollRolling(messageId, false);
}

onCardNotice(REROLL_ROLLING_TYPE, (payload) => {
	if (typeof payload.messageId !== 'string' || !payload.messageId) return;
	const roll = payload.roll as RollingReroll | null | undefined;
	if (roll && (typeof roll.slot !== 'string' || typeof roll.faces !== 'number')) return;
	applyRerollRolling(payload.messageId, roll ?? null);
});

/** Show a card's rolling reroll die on every client, or stop it with `null`. */
export function broadcastRerollRolling(messageId: string, roll: RollingReroll | null): void {
	applyRerollRolling(messageId, roll);
	sendCardNotice(REROLL_ROLLING_TYPE, { messageId, roll });
}
