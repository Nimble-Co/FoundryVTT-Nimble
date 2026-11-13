import { systemHookName } from '#system';
import type { CheckResult } from '#types/checkResult.d.ts';
import { isActiveGM } from '#utils/isActiveGM.js';
import { checkResultOfCard } from '#utils/rolls/checkResult.js';
import type { NimbleSavePayload } from './ruleEventDispatch.js';

interface SaveCardSystem extends Record<string, unknown> {
	saveKey?: string;
	skillKey?: string;
	actorUuid?: string | null;
	tokenUuid?: string | null;
	reportedSaveResult?: CheckResult | null;
	reportedCheckResult?: CheckResult | null;
}

interface SaveCard {
	id?: string | null;
	type: string;
	system: SaveCardSystem;
	rolls: Array<{ total?: number | null; terms: unknown[] }>;
	update: (changes: Record<string, unknown>) => Promise<unknown>;
}

/** The result of a skill check card, told on the hook `skillCheckResolved`. */
export interface NimbleSkillCheckPayload {
	actor: NimbleSavePayload['actor'];
	skillKey: string;
	outcome: NimbleSavePayload['outcome'];
	messageId: string;
}

type Outcome = NimbleSavePayload['outcome'];

/** For each card type that tells its result: where it stores the last one told, and its hook. */
const REPORTED = {
	savingThrow: {
		field: 'reportedSaveResult',
		hook: 'saveResolved',
		payload: (card: SaveCard, actor: NimbleSavePayload['actor'], outcome: Outcome) =>
			({
				actor,
				saveType: card.system.saveKey ?? '',
				outcome,
				messageId: card.id ?? '',
			}) satisfies NimbleSavePayload,
	},
	skillCheck: {
		field: 'reportedCheckResult',
		hook: 'skillCheckResolved',
		payload: (card: SaveCard, actor: NimbleSavePayload['actor'], outcome: Outcome) =>
			({
				actor,
				skillKey: card.system.skillKey ?? '',
				outcome,
				messageId: card.id ?? '',
			}) satisfies NimbleSkillCheckPayload,
	},
} as const;

type ReportedType = keyof typeof REPORTED;

const isReported = (type: string): type is ReportedType => Object.hasOwn(REPORTED, type);

const OUTCOME_OF_RESULT = { failed: 'fail', succeeded: 'pass' } as const;

const lastReported = (card: SaveCard, type: ReportedType) =>
	(card.system[REPORTED[type].field] as CheckResult | null | undefined) ?? null;

/** The card's result when it differs from the last one told. Null is a result no longer known. */
function unreportedResult(card: SaveCard, type: ReportedType): CheckResult | null | undefined {
	const result = checkResultOfCard(card.type, card.system, card.rolls[0]);
	return result === lastReported(card, type) ? undefined : result;
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
	const type = card.type;
	if (!isActiveGM() || !isReported(type)) return;
	const messageId = card.id ?? null;
	if (!messageId || reporting.has(messageId)) return;

	const actor = saverOf(card.system);
	if (!actor) return;

	const { field, hook, payload } = REPORTED[type];
	reporting.add(messageId);
	try {
		// A write that lands during the await returns above, so read the card again after it.
		let result = unreportedResult(card, type);
		while (result !== undefined) {
			// Written first: a lost write must not fire the same result twice.
			await card.update({ [`system.${field}`]: result });
			if (lastReported(card, type) !== result) return;

			const outcome = result ? OUTCOME_OF_RESULT[result] : 'unknown';
			// @ts-expect-error - nimble.saveResolved and nimble.skillCheckResolved are custom Nimble hooks
			Hooks.callAll(systemHookName(hook), payload(card, actor, outcome));
			result = unreportedResult(card, type);
		}
	} catch (error) {
		console.error('Nimble | The result of a check card could not be reported.', error);
	} finally {
		reporting.delete(messageId);
	}
}

let didRegister = false;

/** Tells the result of a save or skill check card, once per change of it, on the active GM. */
export function registerSaveResolvedHooks(): void {
	if (didRegister) return;
	didRegister = true;
	const onCard = (card: unknown) => {
		void reportSaveResult(card as SaveCard);
	};
	Hooks.on('createChatMessage', onCard);
	Hooks.on('updateChatMessage', onCard);
}
