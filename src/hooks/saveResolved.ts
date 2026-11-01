import { systemHookName } from '#system';
import { isActiveGM } from '../utils/isActiveGM.js';
import { type CheckResult, checkResultOfCard } from '../utils/rolls/checkResult.js';
import type { NimbleSavePayload } from './ruleEventDispatch.js';

interface SaveCardSystem extends Record<string, unknown> {
	saveKey?: string;
	actorUuid?: string | null;
	tokenUuid?: string | null;
	reportedSaveResult?: CheckResult | null;
}

interface SaveCard {
	id?: string | null;
	type: string;
	system: SaveCardSystem;
	rolls: Array<{ total?: number | null; terms: unknown[] }>;
	update: (changes: Record<string, unknown>) => Promise<unknown>;
}

const OUTCOME_OF_RESULT = { failed: 'fail', succeeded: 'pass' } as const;

const lastReported = (card: SaveCard) => card.system.reportedSaveResult ?? null;

/** The card's result when it differs from the last one told. Null is a result no longer known. */
function unreportedResult(card: SaveCard): CheckResult | null | undefined {
	const result = checkResultOfCard(card.type, card.system, card.rolls[0]);
	return result === lastReported(card) ? undefined : result;
}

function saverOf(system: SaveCardSystem): NimbleSavePayload['actor'] | null {
	const { actorUuid, tokenUuid } = system;
	const actor = actorUuid ? fromUuidSync(actorUuid as `Actor.${string}`) : null;
	const token = !actor && tokenUuid ? fromUuidSync(tokenUuid as `Scene.${string}`) : null;
	return (actor ?? (token as { actor?: unknown } | null)?.actor ?? null) as
		| NimbleSavePayload['actor']
		| null;
}

const reporting = new Set<string>();

async function reportSaveResult(card: SaveCard): Promise<void> {
	if (!isActiveGM() || card.type !== 'savingThrow') return;
	const messageId = card.id ?? null;
	if (!messageId || reporting.has(messageId)) return;

	const actor = saverOf(card.system);
	if (!actor) return;

	reporting.add(messageId);
	try {
		// A write that lands during the await returns above, so read the card again after it.
		let result = unreportedResult(card);
		while (result !== undefined) {
			// Written first: a lost write must not fire the same result twice.
			await card.update({ 'system.reportedSaveResult': result });
			if (lastReported(card) !== result) return;

			const payload: NimbleSavePayload = {
				actor,
				saveType: card.system.saveKey ?? '',
				outcome: result ? OUTCOME_OF_RESULT[result] : 'unknown',
				messageId,
			};
			// @ts-expect-error - nimble.saveResolved is a custom Nimble hook
			Hooks.callAll(systemHookName('saveResolved'), payload);
			result = unreportedResult(card);
		}
	} catch (error) {
		console.error('Nimble | The result of a save card could not be reported.', error);
	} finally {
		reporting.delete(messageId);
	}
}

let didRegister = false;

/** Tells rules the result of a save card, once per change of it, on the active GM. */
export function registerSaveResolvedHooks(): void {
	if (didRegister) return;
	didRegister = true;
	const onCard = (card: unknown) => {
		void reportSaveResult(card as SaveCard);
	};
	Hooks.on('createChatMessage', onCard);
	Hooks.on('updateChatMessage', onCard);
}
