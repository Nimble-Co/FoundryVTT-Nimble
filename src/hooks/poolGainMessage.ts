import { systemHookName } from '#system';
import {
	isChatNotificationsAutomationEnabled,
	isRuleAutomationEnabled,
} from '../settings/automationSettings.js';

let registered = false;

type PoolChangedPayload = {
	actor?: unknown;
	poolId?: string;
	poolLabel?: string;
	previousFaces?: number[];
	newFaces?: number[];
};

type PoolGainRuleLike = {
	type?: string;
	disabled?: boolean;
	poolIdentifier?: string;
	appliesTo?: () => boolean;
	resolveMessage?: () => string;
	onPoolGain?: (context: { poolIdentifier: string; poolLabel?: string }) => Promise<void>;
};

type ActorWithRules = Actor.Implementation & {
	rules?: Iterable<PoolGainRuleLike>;
};

function postPoolGainMessages(actor: ActorWithRules, poolIdentifier: string): void {
	for (const rule of actor.rules ?? []) {
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
}

// Each freeMove rule checks its own trigger, pool, and predicate.
function offerPoolGainFreeMoves(
	actor: ActorWithRules,
	poolIdentifier: string,
	poolLabel: string | undefined,
): void {
	for (const rule of actor.rules ?? []) {
		if (rule.type !== 'freeMove' || typeof rule.onPoolGain !== 'function') continue;
		rule.onPoolGain({ poolIdentifier, poolLabel }).catch((error: unknown) => {
			// eslint-disable-next-line no-console
			console.warn('Nimble | freeMove onPoolGain failed', error);
		});
	}
}

/**
 * Reacts when a dice pool gains dice: posts each matching poolGainMessage
 * rule's chat reminder, and lets freeMove rules offer their move. Listens to
 * the pool-changed event, which fires locally on the client that performed
 * the change, so each output happens exactly once regardless of how the gain
 * happened (activation roll, refill trigger, or manual sheet edit).
 */
export function registerPoolGainMessageHooks(): void {
	if (registered) return;
	registered = true;

	// @ts-expect-error Custom hook
	Hooks.on(systemHookName('dicePool.changed'), (payload: PoolChangedPayload) => {
		const previousCount = payload.previousFaces?.length ?? 0;
		const newCount = payload.newFaces?.length ?? 0;
		if (newCount <= previousCount) return;

		const actor = payload.actor as ActorWithRules | null | undefined;
		if (!actor?.rules) return;
		const poolId = payload.poolId ?? '';
		// Actor-scoped pool ids carry an "actor:" prefix; rules reference the
		// bare identifier in both scopes.
		const poolIdentifier = poolId.startsWith('actor:') ? poolId.slice('actor:'.length) : poolId;

		if (isChatNotificationsAutomationEnabled()) postPoolGainMessages(actor, poolIdentifier);
		if (isRuleAutomationEnabled()) offerPoolGainFreeMoves(actor, poolIdentifier, payload.poolLabel);
	});
}
