import type { NimbleCharacter } from '#documents/actor/character.js';
import { applyEffectToActor, payloadFromEffect } from '#utils/actor/applyEffectToActor.js';
import { addBankedDamageReduction } from '#utils/damage/bankedDamageReduction.js';
import type { DicePoolConsumer } from '#utils/dicePool/dicePoolConsumers.js';
import { maximizePoolDie, setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { substituteSpendFormula } from '#utils/dicePool/substituteSpendFormula.js';
import localize from '#utils/localize.ts';

export interface SpendablePool {
	id: string;
	label: string;
	faces: readonly number[];
}

export interface SpendDicePoolRequest {
	actor: NimbleCharacter;
	pool: SpendablePool;
	consumer: DicePoolConsumer;
	/** Indices into `pool.faces` that the player picked. */
	selectedIndices: Iterable<number>;
}

function chatMessageClass(): typeof ChatMessage {
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

	const ChatMessageCls = chatMessageClass();
	await ChatMessageCls.create({
		speaker: ChatMessageCls.getSpeaker({ actor }),
		content: spendFlavor(consumer.itemName, subLine),
	} as ChatMessage.CreateData);
}

interface GivenEffect {
	name: string;
	transfer?: boolean;
	toObject(): Record<string, unknown>;
}

type TargetActor = Parameters<typeof applyEffectToActor>[0];

/** The first effect of the consumer's item that does not go on its owner. */
function effectToGive(
	actor: NimbleCharacter,
	consumer: DicePoolConsumer,
): { effect: GivenEffect; itemUuid: string } | null {
	const item = actor.items.get(consumer.itemId) as
		| { uuid: string; effects?: Iterable<GivenEffect> }
		| undefined;
	const effect = [...(item?.effects ?? [])].find((entry) => entry.transfer === false);
	return item && effect ? { effect, itemUuid: item.uuid } : null;
}

function targetActors(): { actor: TargetActor; name: string }[] {
	return Array.from(game.user?.targets ?? []).flatMap((token) => {
		const target = (token as { actor?: TargetActor | null }).actor;
		return target ? [{ actor: target, name: target.name ?? '' }] : [];
	});
}

/** The picked dice leave the pool and the item's effect goes on each target. With no target nothing is spent. */
async function applyGiveEffect(
	request: SpendDicePoolRequest,
	spentFaces: number[],
	nextFaces: number[],
): Promise<void> {
	const { actor, pool, consumer } = request;
	const targets = targetActors();
	if (targets.length < 1) {
		ui.notifications?.warn(
			localize('NIMBLE.dicePoolTracker.panel.useFeature.giveEffectNoTarget', {
				name: consumer.itemName,
			}),
		);
		return;
	}
	const given = effectToGive(actor, consumer);
	if (!given) {
		console.warn(`Nimble | ${consumer.itemName} has no effect to give.`);
		return;
	}

	await setPoolFaces(actor, pool.id, nextFaces);
	const payload = payloadFromEffect(given.effect, {
		itemUuid: given.itemUuid,
		user: actor as unknown as Parameters<typeof payloadFromEffect>[1]['user'],
	});
	const names: string[] = [];
	for (const target of targets) {
		if (await applyEffectToActor(target.actor, payload)) names.push(target.name);
	}

	const lines = [
		localize('NIMBLE.dicePoolTracker.panel.useFeature.spentNote', {
			count: String(spentFaces.length),
			label: pool.label,
			faces: spentFaces.join(', '),
		}),
		...(names.length
			? [
					localize('NIMBLE.dicePoolTracker.panel.useFeature.givenNote', {
						effect: given.effect.name,
						names: names.join(', '),
					}),
				]
			: []),
	];
	const ChatMessageCls = chatMessageClass();
	await ChatMessageCls.create({
		speaker: ChatMessageCls.getSpeaker({ actor }),
		content: spendFlavor(
			consumer.itemName,
			lines.map((line) => foundry.utils.escapeHTML(line)).join('<br />'),
		),
	} as ChatMessage.CreateData);
}

/**
 * Use the picked dice of a rolled pool for one consumer. A `maximize` consumer
 * raises the dice in place. A `giveEffect` consumer gives its item's effect to
 * each target. Any other consumer removes them from the pool, rolls its effect
 * formula with `@n` and `@sum`, banks the total for a `damageReduction` effect,
 * and posts the roll to chat.
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

	if (consumer.effectType === 'giveEffect') {
		await applyGiveEffect(request, spentFaces, nextFaces);
		return;
	}

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
		localize('NIMBLE.dicePoolTracker.panel.useFeature.spentNote', {
			count: String(spentFaces.length),
			label: pool.label,
			faces: spentFaces.join(', '),
		}),
	);
	if (consumer.effectType === 'damageReduction') {
		subLine += `<br />${foundry.utils.escapeHTML(localize('NIMBLE.dicePoolTracker.panel.useFeature.bankedReductionNote'))}`;
	}

	await effectRoll.toMessage({
		speaker: chatMessageClass().getSpeaker({ actor }),
		flavor: spendFlavor(consumer.itemName, subLine),
	} as Parameters<Roll['toMessage']>[0]);
}
