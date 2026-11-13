import { SYSTEM_ID, systemHookName } from '#system';
import type { ApplyEffectNode, EffectNode } from '#types/effectTree.js';
import { takeBackStack } from '#utils/actor/effectStacks.js';
import {
	applyEffectFromCard,
	type EffectCard,
	forgetAppliedEffect,
} from '#utils/chat/applyEffectFromCard.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { askedByOf } from '#utils/rolls/saveFromCard.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';
import type { NimbleSavePayload } from './ruleEventDispatch.js';

const RECORD_FLAG = 'saverSteps';

/** What a save card put on its saver: the step, and the effect it went on as. */
interface SaverRecord {
	stepId: string;
	effectUuid: string;
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

async function takeBack(host: EffectCard, record: SaverRecord): Promise<void> {
	const effect = fromUuidSync(record.effectUuid as never, { strict: false });
	if (effect) await takeBackStack(effect as never);
	await forgetAppliedEffect(host, record.stepId, record.effectUuid);
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
			if (applied && !applied.stays) kept.push({ stepId: step.id, effectUuid: applied.effectUuid });
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
