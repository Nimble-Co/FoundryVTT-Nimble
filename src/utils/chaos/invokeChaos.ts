import { SYSTEM_ID } from '#system';
import type { ChaosCardDoc, ChaosRoll, ChaosRollChoice } from '#types/chaos.d.ts';
import { showsChaosTableRolls } from '../../settings/chaosTableSettings.js';
import { spendRuleCharge } from '../chargePool/ruleChargeGate.js';
import localize from '../localize.js';
import { canPayRerollCost, type RerollCost } from '../reroll/rerollCost.js';
import { canShowDiceAnimation, showDiceAnimation } from '../rolls/showDiceAnimation.js';

/** The flag of a card that already invoked Chaos. */
export const CHAOS_INVOKED_FLAG = 'chaosInvoked';

interface ChaosActor {
	uuid?: string;
	name?: string | null;
	img?: string | null;
	permission?: number;
	type?: string;
	rules?: Iterable<unknown>;
}

interface ChaosRuleLike {
	type?: string;
	invokesChaos?: boolean;
	applies?: boolean;
	rollTwice?: boolean;
	advantage?: boolean;
	chooseChargePool?: string;
}

interface TableResultLike {
	range?: number[];
	name?: string;
	description?: string;
}

function chaosRules(actor: ChaosActor | null | undefined): ChaosRuleLike[] {
	const rules = actor?.rules;
	if (!rules || typeof (rules as Iterable<unknown>)[Symbol.iterator] !== 'function') return [];
	return Array.from(rules) as ChaosRuleLike[];
}

/** Whether this hero can invoke Chaos. */
export function canInvokeChaos(actor: ChaosActor | null | undefined): boolean {
	return chaosRules(actor).some((rule) => rule?.type === 'invokeChaos' && rule.invokesChaos);
}

function options(actor: ChaosActor | null | undefined) {
	const rules = chaosRules(actor).filter((rule) => rule?.type === 'chaosOptions' && rule.applies);
	const twice = rules.find((rule) => rule.rollTwice);
	return {
		rollTwice: !!twice,
		pool: twice?.chooseChargePool ?? '',
		advantage: rules.some((rule) => rule.advantage),
	};
}

function chargeCost(pool: string): RerollCost {
	return {
		chargePoolIdentifier: pool,
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		actionCost: 0,
	};
}

async function tableResultFor(value: number): Promise<{ name: string; text: string }> {
	const pack = game.packs?.get(`${SYSTEM_ID}.nimble-tables`) as unknown as
		| { getDocuments(query?: object): Promise<Array<{ results?: Iterable<TableResultLike> }>> }
		| undefined;
	const [table] = (await pack?.getDocuments({ name: 'Chaos Table' })) ?? [];
	const result = Array.from(table?.results ?? []).find(
		({ range }) => !!range && range[0] <= value && value <= range[1],
	);
	return { name: result?.name ?? '', text: result?.description ?? '' };
}

async function rollOnTable(advantage: boolean): Promise<ChaosRoll> {
	const roll = new foundry.dice.Roll(advantage ? '2d20kh' : '1d20');
	await roll.evaluate();
	if (canShowDiceAnimation()) await showDiceAnimation(roll as never);
	const results = (roll.dice[0]?.results ?? []) as Array<{ result: number; active?: boolean }>;
	const value = roll.total ?? 0;
	const entry = showsChaosTableRolls() ? await tableResultFor(value) : { name: '', text: '' };
	return {
		value,
		dropped: results.find((result) => result.active === false)?.result ?? null,
		...entry,
	};
}

/**
 * With the table secret: tell the GM the rolls that stand. A player's client cannot
 * write this, because the author of a whisper can read it.
 */
export async function whisperChaosRollsToGm(
	actorName: string,
	rolls: readonly ChaosRoll[],
): Promise<void> {
	const lines = await Promise.all(
		rolls.map(async ({ value }) => {
			const entry = await tableResultFor(value);
			return `<p><strong>${value}: ${foundry.utils.escapeHTML(entry.name)}</strong></p>${entry.text}`;
		}),
	);
	const gms = (game.users?.filter((user) => user.isGM) ?? []).map((user) => user.id);
	await ChatMessage.create({
		content: `<p>${foundry.utils.escapeHTML(
			localize('NIMBLE.chat.chaos.whisper', { name: actorName }),
		)}</p>${lines.join('')}`,
		whisper: gms,
	} as unknown as ChatMessage.CreateData);
}

function usesOfPool(actor: ChaosActor, pool: string): number {
	if (!pool) return 0;
	return canPayRerollCost(actor as never, chargeCost(pool)) ? 1 : 0;
}

/** Each table roll has its own card. A hero who can roll twice picks before the roll. */
export async function invokeChaos(
	actor: ChaosActor,
	attackMessageId: string | null = null,
): Promise<void> {
	const { rollTwice, pool, advantage } = options(actor);
	const rolls = rollTwice ? [] : [await rollOnTable(advantage)];
	await ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor: actor as never }),
		type: 'chaos',
		system: {
			actorName: actor.name ?? '',
			actorType: actor.type ?? '',
			image: actor.img ?? 'icons/svg/item-bag.svg',
			permissions: actor.permission ?? 0,
			rollMode: advantage ? 1 : 0,
			actorUuid: actor.uuid ?? '',
			attackMessageId,
			status: rollTwice ? 'choosing' : 'done',
			advantage,
			rolls,
			kept: null,
			chooseUses: rollTwice ? usesOfPool(actor, pool) : 0,
		},
	} as unknown as ChatMessage.CreateData);
}

/** A button of the Chaos card, before the roll. */
export async function chooseChaosRoll(
	card: ChaosCardDoc,
	actor: ChaosActor | null,
	choice: ChaosRollChoice,
): Promise<void> {
	const { system } = card;
	if (system.status !== 'choosing') return;
	if (choice === 'choose') {
		if (system.chooseUses < 1 || !actor) return;
		const spent = await spendRuleCharge(actor as never, options(actor).pool);
		if (spent === false) return;
	}
	const rolls = [await rollOnTable(system.advantage)];
	if (choice !== 'once') rolls.push(await rollOnTable(system.advantage));
	await card.update({
		'system.rolls': rolls,
		'system.status': choice === 'choose' ? 'picking' : 'done',
	});
}

/** With Roll twice, choose one: this roll stands. */
export async function keepChaosRoll(card: ChaosCardDoc, index: number): Promise<void> {
	const { system } = card;
	const kept = system.rolls[index];
	if (system.status !== 'picking' || !kept) return;
	await card.update({ 'system.kept': index, 'system.status': 'done' });
}
