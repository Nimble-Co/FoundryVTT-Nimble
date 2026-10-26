import { SvelteMap } from 'svelte/reactivity';

/** A card roll whose reroll dice are in the air. */
export interface RollingReroll {
	/** Which roll on the card: the damage node id, or `check` for a check card's d20. */
	slot: string;
	faces: number;
}

/** A card shows its old roll again if the new one never arrives. */
const ROLLING_TIMEOUT = 15_000;
/** How long a new result counts as just landed, so a fresh card render still settles it in. */
const LANDED_WINDOW = 1_000;

const rolling = new SvelteMap<string, RollingReroll>();
const landed = new SvelteMap<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(key: string): void {
	clearTimeout(timers.get(key));
	timers.delete(key);
}

/** The roll on this card whose reroll dice are in the air, if any. */
export function rollingRerollOf(messageId: string | null | undefined): RollingReroll | null {
	return messageId ? (rolling.get(messageId) ?? null) : null;
}

/** Whether this roll's new result just replaced a rolling die. */
export function rerollJustLanded(messageId: string | null | undefined, slot: string): boolean {
	return !!messageId && landed.get(messageId) === slot;
}

export function startRerollRolling(messageId: string, roll: RollingReroll): void {
	clearTimer(messageId);
	landed.delete(messageId);
	rolling.set(messageId, roll);
	timers.set(
		messageId,
		setTimeout(() => stopRerollRolling(messageId, false), ROLLING_TIMEOUT),
	);
}

/** Ends the rolling die. `withNewResult` lets the new result settle in. */
export function stopRerollRolling(messageId: string, withNewResult = true): void {
	const roll = rolling.get(messageId);
	if (!roll) return;
	clearTimer(messageId);
	rolling.delete(messageId);
	if (!withNewResult) return;

	const key = `landed:${messageId}`;
	clearTimer(key);
	landed.set(messageId, roll.slot);
	timers.set(
		key,
		setTimeout(() => {
			timers.delete(key);
			if (landed.get(messageId) === roll.slot) landed.delete(messageId);
		}, LANDED_WINDOW),
	);
}

let hasRegisteredHook = false;

/** A card's new roll ends its rolling die on every client. */
export function registerRerollRollingHook(): void {
	if (hasRegisteredHook) return;
	hasRegisteredHook = true;
	Hooks.on('updateChatMessage', (message: { id?: string | null }, changes: object) => {
		if (message.id && 'rolls' in changes) stopRerollRolling(message.id);
	});
}
