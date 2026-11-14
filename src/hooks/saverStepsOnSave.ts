import { SYSTEM_ID, systemHookName } from '#system';
import type { ApplyEffectNode, EffectNode } from '#types/effectTree.js';
import { EFFECT_RECREATED_OPTION } from '#utils/actor/applyConditionToActor.js';
import type { AppliedEffect } from '#utils/actor/applyEffectToActor.js';
import { takeBackStack, UNDO_APPLICATION_OPTION } from '#utils/actor/effectStacks.js';
import { actOnStackGain } from '#utils/actor/stackGainLine.js';
import {
	applyEffectFromCard,
	type EffectCard,
	forgetAppliedEffect,
} from '#utils/chat/applyEffectFromCard.js';
import { cardEventsOf } from '#utils/chat/cardEvents.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { askedByOf } from '#utils/rolls/saveFromCard.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';
import type { NimbleSavePayload } from './ruleEventDispatch.js';

const RECORD_FLAG = 'saverSteps';

/** What a save card put on its saver: the step, the effect it went on as, and what came with it. */
interface SaverRecord {
	stepId: string;
	effectUuid: string;
	/** The "At N stacks" effect this application gave. */
	gainedUuid?: string;
	/** The source data of the older copies it replaced. */
	replaced?: Record<string, unknown>[];
}

interface SaveCard {
	id?: string | null;
	flags?: Record<string, unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

const BRANCH_OF_OUTCOME = { fail: 'failedSave', pass: 'passedSave' } as const;

function recordsOf(saveCard: SaveCard): SaverRecord[] {
	const records = (saveCard.flags?.[SYSTEM_ID] as Record<string, unknown> | undefined)?.[
		RECORD_FLAG
	];
	return Array.isArray(records) ? (records as SaverRecord[]) : [];
}

/** The steps for each creature that fails or saves, under the save step that asked, by branch. */
function saverStepsOf(host: EffectCard, saveNodeId: string): ApplyEffectNode[] {
	const tree =
		(host.system as { activation?: { effects?: EffectNode[] } } | undefined)?.activation?.effects ??
		[];
	return flattenEffectsTree(tree).filter(
		(node): node is ApplyEffectNode =>
			node.type === 'applyEffect' && node.recipient === 'savers' && node.parentNode === saveNodeId,
	);
}

/** The older copies come back when the take-back removed the copy that replaced them. */
async function putBackReplaced(record: SaverRecord, holder: unknown): Promise<void> {
	if (!record.replaced?.length || !holder) return;
	if (fromUuidSync(record.effectUuid as never, { strict: false })) return;
	const ActiveEffectClass = CONFIG.ActiveEffect.documentClass as unknown as {
		create(data: object[], options: object): Promise<unknown>;
	};
	await ActiveEffectClass.create(record.replaced, {
		parent: holder,
		keepId: true,
		[EFFECT_RECREATED_OPTION]: true,
	});
}

async function takeBack(host: EffectCard, record: SaverRecord): Promise<void> {
	const effect = fromUuidSync(record.effectUuid as never, { strict: false }) as {
		parent?: unknown;
	} | null;
	if (effect) {
		await takeBackStack(effect as never);
		await putBackReplaced(record, effect.parent);
	}
	if (record.gainedUuid) await takeBackGained(host, record.gainedUuid);
	await forgetAppliedEffect(host, record.stepId, record.effectUuid);
}

/** The "At N stacks" effect goes as the Undo of its line does, so the line reads undone. */
async function takeBackGained(host: EffectCard, gainedUuid: string): Promise<void> {
	const line = cardEventsOf(host as never).find(
		(event) =>
			event.action?.kind === 'stackGain' &&
			event.action.state === 'gained' &&
			event.action.gainedUuid === gainedUuid,
	);
	if (line && (await actOnStackGain(host, line))) return;
	const gained = fromUuidSync(gainedUuid as never, { strict: false }) as {
		delete(options?: object): Promise<unknown>;
	} | null;
	await gained?.delete({ [UNDO_APPLICATION_OPTION]: true });
}

function recordOf(stepId: string, applied: AppliedEffect): SaverRecord {
	const gainedUuid = applied.stackReached?.gainedUuid;
	return {
		stepId,
		effectUuid: applied.effectUuid,
		...(gainedUuid ? { gainedUuid } : {}),
		...(applied.replaced?.length ? { replaced: applied.replaced } : {}),
	};
}

const queue = keyedQueue();

/**
 * Follows the result of a save that a card's save step asked for: the steps for each creature
 * that fails (or saves) go on the saver, and a result that changes takes back what the old one
 * put on, once. With Feature Effects off, the steps keep their buttons.
 */
export function followSaverSteps(payload: NimbleSavePayload): Promise<void> {
	return queue.run(payload.messageId, async () => {
		if (!isRuleAutomationEnabled()) return;
		const saveCard = game.messages?.get(payload.messageId) as unknown as SaveCard | undefined;
		const asked = askedByOf(saveCard);
		const host = asked
			? (game.messages?.get(asked.cardId) as unknown as EffectCard | undefined)
			: undefined;
		if (!saveCard || !asked || !host) return;

		const branch = payload.outcome === 'unknown' ? null : BRANCH_OF_OUTCOME[payload.outcome];
		const steps = saverStepsOf(host, asked.nodeId);
		const kept: SaverRecord[] = [];
		for (const record of recordsOf(saveCard)) {
			const step = steps.find((each) => each.id === record.stepId);
			if (step && step.parentContext === branch) kept.push(record);
			else await takeBack(host, record);
		}
		for (const step of steps) {
			if (step.parentContext !== branch || kept.some((record) => record.stepId === step.id)) {
				continue;
			}
			const [applied] = await applyEffectFromCard(host, step, {
				recipients: [payload.actor as never],
			});
			if (applied && !applied.stays) kept.push(recordOf(step.id, applied));
		}
		await saveCard.update({ [`flags.${SYSTEM_ID}.${RECORD_FLAG}`]: kept });
	});
}

let registered = false;

/** `saveResolved` fires on the active GM, who can put an effect on every creature. */
export function registerSaverStepsHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on(
		systemHookName('saveResolved') as never,
		((payload: NimbleSavePayload) => {
			if (!isActiveGM()) return;
			void followSaverSteps(payload).catch((error) => {
				console.error('Nimble | Could not follow the effects of a save result.', error);
			});
		}) as never,
	);
}
