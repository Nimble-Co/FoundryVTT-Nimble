/**
 * Throw Dice So Nice's dice for a roll that was written onto an existing chat
 * message.
 *
 * DSN hangs its animation off `createChatMessage`, so a roll added by
 * `update()` never reaches it and the number simply appears. `showForRoll` is
 * the module's own entry point for that case. It resolves immediately when DSN
 * is absent or disabled, so callers need no capability check of their own.
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

	await dice3d.showForRoll(
		roll,
		game.user,
		true,
		whisper?.length ? whisper : null,
		message?.blind ?? false,
		messageId ?? null,
		message?.speaker ?? null,
	);
}
