import { systemHookName } from '#system';
import { isChatNotificationsAutomationEnabled } from '../settings/automationSettings.js';

let registered = false;

type PoolChangedPayload = {
	actor?: unknown;
	poolId?: string;
	previousFaces?: number[];
	newFaces?: number[];
};

type PoolGainMessageRuleLike = {
	type?: string;
	disabled?: boolean;
	poolIdentifier?: string;
	appliesTo?: () => boolean;
	resolveMessage?: () => string;
};

type ActorWithRules = Actor.Implementation & {
	rules?: Iterable<PoolGainMessageRuleLike>;
};

/**
 * Posts each matching poolGainMessage rule's chat reminder when a dice pool
 * gains dice. Listens to the pool-changed event, which fires locally on the
 * client that performed the change, so the message posts exactly once
 * regardless of how the gain happened (activation roll, refill trigger, or
 * manual sheet edit).
 */
export function registerPoolGainMessageHooks(): void {
	if (registered) return;
	registered = true;

	// @ts-expect-error Custom hook
	Hooks.on(systemHookName('dicePool.changed'), (payload: PoolChangedPayload) => {
		if (!isChatNotificationsAutomationEnabled()) return;
		const previousCount = payload.previousFaces?.length ?? 0;
		const newCount = payload.newFaces?.length ?? 0;
		if (newCount <= previousCount) return;

		const actor = payload.actor as ActorWithRules | null | undefined;
		if (!actor?.rules) return;
		const poolId = payload.poolId ?? '';
		// Actor-scoped pool ids carry an "actor:" prefix; rules reference the
		// bare identifier in both scopes.
		const poolIdentifier = poolId.startsWith('actor:') ? poolId.slice('actor:'.length) : poolId;

		for (const rule of actor.rules) {
			if (rule.type !== 'poolGainMessage' || rule.disabled) continue;
			if ((rule.poolIdentifier ?? '').trim() !== poolIdentifier) continue;
			if (typeof rule.appliesTo === 'function' && !rule.appliesTo()) continue;
			const content = rule.resolveMessage?.();
			if (!content) continue;

			void ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor }),
				content: `<p>${content}</p>`,
			} as unknown as ChatMessage.CreateData);
		}
	});
}
