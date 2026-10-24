/** Whether Dice So Nice is on for this client, so a roll will be thrown. */
export function canShowDiceAnimation(): boolean {
	const { dice3d } = game as { dice3d?: { showForRoll?: unknown; isEnabled?: () => boolean } };
	if (!dice3d?.showForRoll) return false;
	return dice3d.isEnabled?.() ?? true;
}

const DICE_WAIT_LIMIT = 10_000;

/**
 * Throw Dice So Nice's dice for a roll that was written onto an existing chat
 * message.
 *
 * DSN hangs its animation off `createChatMessage`, so a roll added by
 * `update()` never reaches it and the number simply appears. `showForRoll` is
 * the module's own entry point for that case. It resolves immediately when DSN
 * is absent or disabled, so callers need no capability check of their own.
 *
 * A hidden tab holds its dice until it is visible again, so the wait ends at
 * once there, and after `DICE_WAIT_LIMIT` anywhere else.
 */
export async function showDiceAnimation(
	roll: foundry.dice.Roll.Any,
	messageId?: string,
): Promise<void> {
	const { dice3d } = game as {
		dice3d?: {
			showForRoll?: (
				roll: foundry.dice.Roll.Any,
				user?: unknown,
				synchronize?: boolean,
				whisper?: string[] | null,
				blind?: boolean,
				messageId?: string | null,
				speaker?: unknown,
			) => Promise<unknown>;
		};
	};

	if (!dice3d?.showForRoll) return;

	const message = messageId ? (game.messages?.get(messageId) ?? null) : null;
	const whisper = (message?.whisper as unknown as string[] | undefined) ?? null;

	const shown = dice3d.showForRoll(
		roll,
		game.user,
		true,
		whisper?.length ? whisper : null,
		message?.blind ?? false,
		messageId ?? null,
		message?.speaker ?? null,
	);
	if (document.hidden) return;

	let timer: ReturnType<typeof setTimeout> | undefined;
	await Promise.race([
		shown,
		new Promise((resolve) => (timer = setTimeout(resolve, DICE_WAIT_LIMIT))),
	]);
	clearTimeout(timer);
}
