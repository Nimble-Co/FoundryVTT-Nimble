import type { CharacterActorLike } from './types.js';

const HOOK_PREFIX = 'nimble.chargePool';

type ChargePoolHookPayload = Record<string, unknown>;

function emit(hookName: string, payload: ChargePoolHookPayload): void {
	// @ts-expect-error Custom hooks are not typed in Foundry
	Hooks.call(`${HOOK_PREFIX}.${hookName}`, payload);
}

function emitCancelable(hookName: string, payload: ChargePoolHookPayload): boolean {
	// @ts-expect-error Custom hooks are not typed in Foundry
	return Hooks.call(`${HOOK_PREFIX}.${hookName}`, payload) !== false;
}

function emitForCharacter(
	actor: CharacterActorLike | null | undefined,
	hookName: string,
	payload: ChargePoolHookPayload,
): void {
	if (actor?.type !== 'character') return;
	emit(hookName, payload);
}

export { emit, emitCancelable, emitForCharacter };
