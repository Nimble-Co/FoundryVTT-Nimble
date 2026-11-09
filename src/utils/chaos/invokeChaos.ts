import { SYSTEM_ID } from '#system';
import type {
	ChaosCardDoc,
	ChaosRoll,
	ChaosRollChoice,
	RollTable,
	TableRollWhen,
} from '#types/chaos.d.ts';
import { showsChaosTableRolls } from '../../settings/chaosTableSettings.js';
import { actorRules } from '../actor/actorRules.js';
import { spendRuleCharge } from '../chargePool/ruleChargeGate.js';
import { canPayUseCost, chargeOnlyCost } from '../cost/useCost.js';
import localize from '../localize.js';
import { canShowDiceAnimation, showDiceAnimation } from '../rolls/showDiceAnimation.js';
import { TABLE_NAMES } from './rollTables.js';

/** The flag of a card that already invoked Chaos. */
export const CHAOS_INVOKED_FLAG = 'chaosInvoked';

/** The flag of a card whose tick waits for the button, with Feature Effects off. */
export const CHAOS_TICKED_FLAG = 'chaosTicked';

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
}

interface TableRollRuleLike {
	type: 'tableRoll';
	table: RollTable;
	when: TableRollWhen;
	invokesChaos: boolean;
}

interface TableRollOptionsRuleLike {
	type: 'tableRollOptions';
	table: RollTable;
	applies: boolean;
	rollTwice: boolean;
	advantage: boolean;
	chooseChargePool: string;
}

const isTableRoll = (rule: ChaosRuleLike | null | undefined): rule is TableRollRuleLike =>
	rule?.type === 'tableRoll';

const isTableRollOptions = (
	rule: ChaosRuleLike | null | undefined,
): rule is TableRollOptionsRuleLike => rule?.type === 'tableRollOptions';

interface TableResultLike {
	range?: number[];
	name?: string;
	description?: string;
}

function chaosRules(actor: ChaosActor | null | undefined): ChaosRuleLike[] {
	return actorRules<ChaosRuleLike>(actor);
}

/** Whether this hero invokes Chaos with the spell tick for 1 less mana and on a crit. */
export function canInvokeChaos(actor: ChaosActor | null | undefined): boolean {
	return chaosRules(actor).some(
		(rule) => isTableRoll(rule) && rule.when !== 'onUse' && rule.invokesChaos,
	);
}

/** The table an item rolls on when it is used, or null. */
export function onUseTableOf(
	item: { rules?: { values(): Iterable<unknown> } } | null | undefined,
): RollTable | null {
	for (const rule of (item?.rules?.values() ?? []) as Iterable<ChaosRuleLike>) {
		if (isTableRoll(rule) && rule.when === 'onUse' && rule.invokesChaos) return rule.table;
	}
	return null;
}

/** The table of the hero's first table roll rule that applies, or null. */
function tableOf(actor: ChaosActor | null | undefined): RollTable | null {
	const rule = chaosRules(actor).find(
		(candidate): candidate is TableRollRuleLike => isTableRoll(candidate) && candidate.invokesChaos,
	);
	return rule?.table ?? null;
}

/** What the hero's table roll options do to a roll on this table. */
function options(actor: ChaosActor | null | undefined, table: RollTable) {
	const rules = chaosRules(actor).filter(
		(rule): rule is TableRollOptionsRuleLike =>
			isTableRollOptions(rule) && rule.table === table && rule.applies,
	);
	const twice = rules.find((rule) => rule.rollTwice);
	return {
		rollTwice: !!twice,
		pool: twice?.chooseChargePool ?? '',
		advantage: rules.some((rule) => rule.advantage),
	};
}

async function tableResultFor(
	table: RollTable,
	value: number,
): Promise<{ name: string; text: string }> {
	const pack = game.packs?.get(`${SYSTEM_ID}.nimble-tables`) as unknown as
		| { getDocuments(query?: object): Promise<Array<{ results?: Iterable<TableResultLike> }>> }
		| undefined;
	const [document] = (await pack?.getDocuments({ name: TABLE_NAMES[table] })) ?? [];
	const result = Array.from(document?.results ?? []).find(
		({ range }) => !!range && range[0] <= value && value <= range[1],
	);
	return { name: result?.name ?? '', text: result?.description ?? '' };
}

async function rollOnTable(table: RollTable, advantage: boolean): Promise<ChaosRoll> {
	const roll = new foundry.dice.Roll(advantage ? '2d20kh' : '1d20');
	await roll.evaluate();
	if (canShowDiceAnimation()) await showDiceAnimation(roll as never);
	const results = (roll.dice[0]?.results ?? []) as Array<{ result: number; active?: boolean }>;
	const value = roll.total ?? 0;
	const entry = showsChaosTableRolls()
		? await tableResultFor(table, value)
		: { name: '', text: '' };
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
	table: RollTable,
): Promise<void> {
	const lines = await Promise.all(
		rolls.map(async ({ value }) => {
			const entry = await tableResultFor(table, value);
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
	return canPayUseCost(actor as never, chargeOnlyCost(pool)) ? 1 : 0;
}

/**
 * Each table roll has its own card. A hero who can roll twice picks before the roll.
 * With no `table`, the hero's table roll rule names it; with no such rule, nothing rolls.
 */
export async function invokeChaos(
	actor: ChaosActor,
	attackMessageId: string | null = null,
	table: RollTable | null = tableOf(actor),
): Promise<void> {
	if (!table) return;
	const { rollTwice, pool, advantage } = options(actor, table);
	const rolls = rollTwice ? [] : [await rollOnTable(table, advantage)];
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
			table,
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
		const spent = await spendRuleCharge(actor as never, options(actor, system.table).pool);
		if (spent === false) return;
	}
	const rolls = [await rollOnTable(system.table, system.advantage)];
	if (choice !== 'once') rolls.push(await rollOnTable(system.table, system.advantage));
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
