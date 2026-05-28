import { systemHookName } from '#system';
import type { CharacterActorLike } from './types.js';

type DicePoolHookPayload = Record<string, unknown>;

function emit(hookName: string, payload: DicePoolHookPayload): void {
	// @ts-expect-error Custom hooks are not typed in Foundry
	Hooks.call(systemHookName(`dicePool.${hookName}`), payload);
}

function emitCancelable(hookName: string, payload: DicePoolHookPayload): boolean {
	// @ts-expect-error Custom hooks are not typed in Foundry
	return Hooks.call(systemHookName(`dicePool.${hookName}`), payload) !== false;
}

function emitForCharacter(
	actor: CharacterActorLike | null | undefined,
	hookName: string,
	payload: DicePoolHookPayload,
): void {
	if (actor?.type !== 'character') return;
	emit(hookName, payload);
}

export { emit, emitCancelable, emitForCharacter };
