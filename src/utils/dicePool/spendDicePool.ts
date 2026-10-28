import type { NimbleCharacter } from '#documents/actor/character.js';
import { addBankedDamageReduction } from '#utils/damage/bankedDamageReduction.js';
import type { DicePoolConsumer } from '#utils/dicePool/dicePoolConsumers.js';
import { maximizePoolDie, setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { substituteSpendFormula } from '#utils/dicePool/substituteSpendFormula.js';
import localize from '#utils/localize.ts';

export interface SpendDicePoolPool {
	id: string;
	label: string;
	faces: readonly number[];
}

export interface SpendDicePoolRequest {
	actor: NimbleCharacter;
	pool: SpendDicePoolPool;
	consumer: DicePoolConsumer;
	/** Indices into `pool.faces` that the player picked. */
	selectedIndices: Iterable<number>;
}

function chatClass(): typeof ChatMessage {
	return (globalThis as unknown as { ChatMessage: typeof ChatMessage }).ChatMessage;
}

function spendFlavor(itemName: string, subLine: string): string {
	const headerLine = `<strong>${foundry.utils.escapeHTML(itemName)}</strong>`;
	return `${headerLine}<div class="nimble-dice-pool-spend-flavor">${subLine}</div>`;
}

/** Raise every picked die to the pool's highest face, leaving the pool size
 *  untouched, and report the before/after faces to chat. The raising itself is
 *  `maximizePoolDie`, shared with the activation-driven pool node, so both entry
 *  points stay in step. */
async function applyMaximizeOutcome(
	request: SpendDicePoolRequest,
	picked: number[],
): Promise<void> {
	const { actor, pool, consumer } = request;
	const result = await maximizePoolDie(actor, pool.id, picked.length, { indices: picked });
	if (!result.changed) return;

	const changes = result.changes.map(({ from, to }) => `${from} → ${to}`);
	const subLine = foundry.utils.escapeHTML(
		localize('NIMBLE.dicePoolTracker.panel.useFeature.maximizedNote', {
			count: String(changes.length),
			label: pool.label,
			changes: changes.join(', '),
		}),
	);

	const ChatMessageCls = chatClass();
	await ChatMessageCls.create({
		speaker: ChatMessageCls.getSpeaker({ actor }),
		content: spendFlavor(consumer.itemName, subLine),
	} as ChatMessage.CreateData);
}

/**
 * Use the picked dice of a rolled pool for one consumer. A `maximize` consumer
 * raises the dice in place. Any other consumer removes them from the pool,
 * rolls its effect formula with `@n` and `@sum`, banks the total for a
 * `damageReduction` effect, and posts the roll to chat.
 */
export async function spendDicePool(request: SpendDicePoolRequest): Promise<void> {
	const { actor, pool, consumer } = request;
	const picked = [...new Set(request.selectedIndices)].filter(
		(index) => index >= 0 && index < pool.faces.length,
	);
	if (picked.length < 1) return;

	if (consumer.selectionOutcome === 'maximize') {
		await applyMaximizeOutcome(request, picked);
		return;
	}

	const pickedSet = new Set(picked);
	const spentFaces = pool.faces.filter((_, index) => pickedSet.has(index));
	const nextFaces = pool.faces.filter((_, index) => !pickedSet.has(index));

	await setPoolFaces(actor, pool.id, nextFaces);

	const substituted = substituteSpendFormula(
		consumer.effectFormula ?? '0',
		spentFaces.length,
		spentFaces.reduce((a, b) => a + b, 0),
	);
	const RollCls = (globalThis as unknown as { Roll: typeof Roll }).Roll;
	const effectRoll = new RollCls(substituted, actor.getRollData());
	await effectRoll.evaluate();

	if (consumer.effectType === 'damageReduction') {
		await addBankedDamageReduction(
			actor,
			effectRoll.total ?? 0,
			consumer.itemImg,
			consumer.itemName,
		);
	}

	let subLine = foundry.utils.escapeHTML(
		`Spent ${spentFaces.length} ${pool.label} (${spentFaces.join(', ')})`,
	);
	if (consumer.effectType === 'damageReduction') {
		subLine += `<br />${foundry.utils.escapeHTML(localize('NIMBLE.dicePoolTracker.panel.useFeature.bankedReductionNote'))}`;
	}

	await effectRoll.toMessage({
		speaker: chatClass().getSpeaker({ actor }),
		flavor: spendFlavor(consumer.itemName, subLine),
	} as Parameters<Roll['toMessage']>[0]);
}
