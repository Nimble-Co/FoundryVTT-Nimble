import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';
import type {
	DefendChoice,
	DefendOption,
	DefendWindowData,
} from '#types/components/DefendDialog.d.ts';
import { spendBaselineInterpose } from '../../view/chat/components/spendBaselineInterpose.js';
import DefendDialog from '../../view/dialogs/DefendDialog.svelte';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import {
	getHeroicReactionUsageState,
	isSoftBlockedReason,
} from '../incomingReactions/getHeroicReactionUsageState.js';
import {
	getHeroicReactionAvailability,
	getHeroicReactionAvailabilityUpdate,
	getHeroicReactionLabel,
	type HeroicReactionKey,
} from '../incomingReactions/heroicActions.js';
import { requestIncomingAttackReaction } from '../incomingReactions/incomingAttackReactions.js';
import resolveHeroicReactionActionCost from '../incomingReactions/resolveHeroicReactionActionCost.js';
import showReactionConfirmation from '../incomingReactions/showReactionConfirmation.js';
import localize from '../localize.js';
import {
	cardRerollFor,
	type DefendOptionPick,
	defendOptionEffect,
	defendOptionsOf,
	defendOptionUse,
	payDefendOption,
} from './defendOptions.js';
import { type DefendReactor, defendReactors } from './defendReactors.js';
import type { DefendOptionUse, DefendOutcome, DefendRecordWay } from './defendRecords.js';
import { requestDefend } from './defendRequests.js';
import { extraDefendUsed, type WholeRoundDefend, wholeRoundDefendOf } from './defendRound.js';
import { type DefendWay, newestDefendCard } from './newestDefendCard.js';

const TEXT = 'NIMBLE.chat.defend';

type ReactionCombat = Combat & {
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: string[],
		options?: { force?: boolean },
	) => Promise<boolean>;
};

function combatantOf(combat: Combat | null, actor: Actor.Implementation, tokenUuid: string | null) {
	if (!combat) return null;
	const token = tokenUuid ? (fromUuidSync(tokenUuid) as TokenDocument | null) : null;
	return (
		(token ? combat.combatants.find((each) => each.tokenId === token.id) : null) ??
		combat.combatants.find((each) => each.actorId === actor.id) ??
		null
	);
}

function actionsText(count: number): string {
	if (count < 1) return localize('NIMBLE.chat.defend.actionsNone');
	return count === 1
		? localize('NIMBLE.chat.defend.actionsOne')
		: localize('NIMBLE.chat.defend.actionsMany', { count: String(count) });
}

function nameOfToken(uuid: string | null | undefined): string {
	const token = uuid ? (fromUuidSync(uuid) as TokenDocument | null) : null;
	return token?.actor?.name || token?.name || '';
}

function armorOf(actor: Actor.Implementation): number {
	const value = Number(foundry.utils.getProperty(actor, 'system.attributes.armor.value'));
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function cardName(card: NimbleChatMessage): string {
	const system = card.system as
		| { name?: string; spellName?: string; groupLabel?: string; actorName?: string }
		| undefined;
	const name = card.isMinionGroupAttackCard()
		? system?.groupLabel || system?.actorName
		: system?.name || system?.spellName || card.flavor;
	return (name || '').replace(/[.\s]+$/, '');
}

function costOf(actor: Actor.Implementation, keys: HeroicReactionKey[]): number {
	return resolveHeroicReactionActionCost(
		actor as unknown as Parameters<typeof resolveHeroicReactionActionCost>[0],
		keys,
	);
}

/** A row's own part of the Defend: what it spends and the option it is. */
interface RowPlan {
	way: DefendRecordWay;
	token: string | null;
	pick: DefendOptionPick | null;
	/** The Defend that lasts the round, for a `round` row. */
	whole: WholeRoundDefend | null;
}

interface WindowPlan {
	data: DefendWindowData;
	rows: Map<string, RowPlan>;
	ticks: Map<string, DefendOptionPick>;
}

function defendSpent(combatant: Combatant.Implementation | null): boolean {
	return (
		!!combatant &&
		game.combat?.started === true &&
		!getHeroicReactionAvailability(combatant, 'defend')
	);
}

function effectOf(
	row: RowPlan | undefined,
	tickPicks: DefendOptionPick[],
): ReturnType<typeof defendOptionEffect> {
	if (row?.whole) {
		return {
			outcome: row.whole.outcome as DefendOutcome,
			armorBonus: row.whole.armorBonus,
			reminders: [],
			attackerConditions: [],
			wholeRound: false,
		};
	}
	const rules = [...(row?.pick ? [row.pick.rule] : []), ...tickPicks.map((pick) => pick.rule)];
	return defendOptionEffect(rules);
}

function damageAfter(
	card: NimbleChatMessage,
	token: string | null,
	armor: number,
	effect: ReturnType<typeof defendOptionEffect>,
): number | null {
	if (!token) return null;
	return card.previewDamageFor(token, {
		armor: armor + effect.armorBonus,
		zero: effect.outcome === 'miss' || effect.outcome === 'noDamage',
		halve: effect.outcome === 'halve',
	});
}

function tickDetail(pick: DefendOptionPick): string {
	return (pick.rule.reminder ?? '').trim();
}

/** What the window shows for one hero, and what each row does. Exported for tests. */
export function defendWindowPlan(card: NimbleChatMessage, reactor: DefendReactor): WindowPlan {
	const { actor } = reactor;
	const armor = armorOf(actor);
	const defendCost = costOf(actor, ['defend']);
	const combatant = combatantOf(game.combat ?? null, actor, reactor.targetTokenUuid);
	const extra =
		defendSpent(combatant) && !extraDefendUsed(actor, combatant?.id)
			? (defendOptionsOf(actor, card, 'extraDefend')[0] ?? null)
			: null;
	const extraNote = extra ? localize(`${TEXT}.extraNote`, { label: extra.label }) : '';
	const options: DefendOption[] = [];
	const rows = new Map<string, RowPlan>();
	const actionWay: DefendRecordWay = extra ? 'extra' : 'action';
	const freePicks = defendOptionsOf(actor, card, 'freeDefend');

	const addRow = (
		option: Omit<DefendOption, 'takes' | 'note'> & { note?: string },
		plan: RowPlan,
	) => {
		const takes = option.defend
			? damageAfter(card, plan.token, armor, effectOf(plan, []))
			: plan.token
				? card.previewDamageFor(plan.token, 0)
				: null;
		options.push({ note: '', ...option, takes });
		rows.set(option.id, plan);
	};
	const freeCost = (pick: DefendOptionPick) =>
		pick.rule.useItem
			? localize(`${TEXT}.itemCost`, {
					item: pick.rule.item?.name ?? pick.label,
					armor: String(armor),
				})
			: localize(`${TEXT}.freeCost`, { armor: String(armor) });

	const whole = reactor.targetTokenUuid ? wholeRoundDefendOf(actor, combatant?.id) : null;
	if (whole && reactor.targetTokenUuid) {
		addRow(
			{
				id: 'round',
				title: localize(`${TEXT}.roundTitle`, {
					label: whole.label || localize(`${TEXT}.confirmDefend`),
				}),
				cost: localize(`${TEXT}.roundCost`, { armor: String(armor) }),
				confirm: localize(`${TEXT}.confirmDefend`),
				before: card.previewDamageFor(reactor.targetTokenUuid, 0),
				defend: true,
				takesTicks: false,
				interposeEntryId: null,
			},
			{ way: 'round', token: reactor.targetTokenUuid, pick: null, whole },
		);
	}

	if (reactor.targetTokenUuid) {
		const before = card.previewDamageFor(reactor.targetTokenUuid, 0);
		addRow(
			{
				id: 'defend',
				title: localize(`${TEXT}.confirmDefend`),
				cost: localize(`${TEXT}.defendCost`, {
					actions: actionsText(defendCost),
					armor: String(armor),
				}),
				note: extraNote,
				confirm: localize(`${TEXT}.confirmDefend`),
				before,
				defend: true,
				takesTicks: true,
				interposeEntryId: null,
			},
			{ way: actionWay, token: reactor.targetTokenUuid, pick: null, whole: null },
		);
		for (const pick of freePicks.filter((each) => !each.rule.withInterpose)) {
			addRow(
				{
					id: `free:${pick.key}`,
					title: pick.label,
					cost: freeCost(pick),
					confirm: localize(`${TEXT}.confirmDefend`),
					before,
					defend: true,
					takesTicks: true,
					interposeEntryId: null,
				},
				{ way: 'free', token: reactor.targetTokenUuid, pick, whole: null },
			);
		}
	}

	const named = reactor.interposes.length > 1;
	for (const entry of reactor.interposes) {
		const name = nameOfToken(entry.targetTokenUuid);
		const interposeCost = entry.source === 'baseline' ? costOf(actor, ['interpose']) : 0;
		const token = entry.tokenUuid || reactor.targetTokenUuid;
		const before = token ? card.previewDamageFor(token, 0) : null;
		addRow(
			{
				id: `interpose:${entry.id}`,
				title: named
					? localize(`${TEXT}.interposeFor`, { name })
					: localize(`${TEXT}.confirmInterpose`),
				cost: actionsText(interposeCost),
				confirm: localize(`${TEXT}.confirmInterpose`),
				before: null,
				defend: false,
				takesTicks: false,
				interposeEntryId: entry.id,
			},
			{ way: 'action', token, pick: null, whole: null },
		);
		addRow(
			{
				id: `both:${entry.id}`,
				title: named
					? localize(`${TEXT}.interposeForAndDefend`, { name })
					: localize(`${TEXT}.confirmBoth`),
				cost: localize(`${TEXT}.defendCost`, {
					actions: actionsText(interposeCost + defendCost),
					armor: String(armor),
				}),
				note: extraNote,
				confirm: localize(`${TEXT}.confirmBoth`),
				before,
				defend: true,
				takesTicks: true,
				interposeEntryId: entry.id,
			},
			{ way: actionWay, token, pick: null, whole: null },
		);
		for (const pick of freePicks.filter((each) => each.rule.withInterpose)) {
			addRow(
				{
					id: `freeboth:${pick.key}:${entry.id}`,
					title: named
						? `${localize(`${TEXT}.interposeForAndDefend`, { name })} (${pick.label})`
						: localize(`${TEXT}.interposeAndFree`, { label: pick.label }),
					cost: `${actionsText(interposeCost)}. ${freeCost(pick)}`,
					confirm: localize(`${TEXT}.confirmBoth`),
					before,
					defend: true,
					takesTicks: true,
					interposeEntryId: entry.id,
				},
				{ way: 'free', token, pick, whole: null },
			);
		}
	}

	// A tick that rerolls needs its reroll on the card: no reroll, no use.
	const tickPicks = defendOptionsOf(actor, card, 'withDefend').filter(
		(pick) =>
			!pick.rule.useReroll ||
			!!cardRerollFor(
				card,
				pick.rule.item?.uuid,
				reactor.targetTokenUuid ?? reactor.interposes[0]?.tokenUuid,
			),
	);
	const ticks = new Map(tickPicks.map((pick) => [pick.key, pick]));
	const hitToken = reactor.targetTokenUuid ?? reactor.interposes[0]?.targetTokenUuid ?? null;
	const hitDamage = hitToken ? card.previewDamageFor(hitToken, 0) : null;
	const attack = cardName(card);
	const name = nameOfToken(hitToken);
	return {
		rows,
		ticks,
		data: {
			heading:
				hitDamage === null
					? localize(`${TEXT}.headingNoDamage`, { attack, name })
					: localize(`${TEXT}.heading`, { attack, name, damage: String(hitDamage) }),
			options,
			ticks: tickPicks.map((pick) => ({
				id: pick.key,
				label: pick.label,
				detail: tickDetail(pick),
			})),
			takesWith: (optionId, tickIds) => {
				const row = rows.get(optionId);
				const option = options.find((each) => each.id === optionId);
				if (!row || !option) return null;
				if (!option.defend) return option.takes;
				const picked = option.takesTicks ? tickIds.flatMap((id) => ticks.get(id) ?? []) : [];
				return damageAfter(card, row.token, armor, effectOf(row, picked));
			},
		},
	};
}

/** What the window shows for one hero. Exported for tests. */
export function defendWindowData(
	card: NimbleChatMessage,
	reactor: DefendReactor,
): DefendWindowData {
	return defendWindowPlan(card, reactor).data;
}

/**
 * One confirm for every reaction the choice spends, when it bends a limit (spent,
 * no actions, own turn). Returns whether to force the spend, or null for no.
 */
async function confirmLimits(
	combat: ReactionCombat | null,
	combatant: Combatant.Implementation | null,
	keys: HeroicReactionKey[],
): Promise<{ force: boolean } | null> {
	if (!combat?.started || !combatant || keys.length < 1) return { force: false };
	const usage = getHeroicReactionUsageState({ combat, combatant, reactionKeys: keys });
	if (usage.blockedReason === null) return { force: false };
	if (!isSoftBlockedReason(usage.blockedReason)) return null;
	const spent = keys.filter((key) => !getHeroicReactionAvailability(combatant, key));
	const confirmed = await showReactionConfirmation({
		reactionName: keys.map(getHeroicReactionLabel).join(' & '),
		spentReactionNames: spent.map(getHeroicReactionLabel).join(' & '),
		noActions: usage.blockedReason === 'noActions',
		hasSpentReactions: spent.length > 0,
		isActiveTurn: usage.blockedReason === 'activeTurn',
	});
	return confirmed ? { force: true } : null;
}

async function spendDefend(
	combat: ReactionCombat | null,
	combatant: Combatant.Implementation | null,
	force: boolean,
): Promise<{ previousActions: number | null } | null> {
	if (!combat?.started || !combat.useHeroicReactions || !combatant?.id) {
		return { previousActions: null };
	}
	const previousActions = Number(
		foundry.utils.getProperty(combatant, 'system.actions.base.current') ?? 0,
	);
	const used = await combat.useHeroicReactions(
		combatant.id,
		['defend'],
		force ? { force: true } : undefined,
	);
	return used ? { previousActions } : null;
}

/** Wait until the card lists the token as a target (the GM writes an Interpose). */
function waitForTarget(
	card: NimbleChatMessage,
	tokenUuid: string,
	timeout = 5000,
): Promise<boolean> {
	const has = () =>
		((game.messages?.get(card.id ?? '')?.system as { targets?: string[] })?.targets ?? []).includes(
			tokenUuid,
		);
	if (has()) return Promise.resolve(true);
	return new Promise((resolve) => {
		const hookId = Hooks.on('updateChatMessage', (message: ChatMessage) => {
			if (message.id !== card.id || !has()) return;
			Hooks.off('updateChatMessage', hookId);
			clearTimeout(timer);
			resolve(true);
		});
		const timer = setTimeout(() => {
			Hooks.off('updateChatMessage', hookId);
			resolve(has());
		}, timeout);
	});
}

function firstOf(data: DefendWindowData, way: DefendWay): string | undefined {
	if (way === 'defend')
		return data.options.find((option) => option.id === 'round' || option.id === 'defend')?.id;
	return data.options.find((option) => option.id.startsWith(`${way}:`))?.id;
}

/**
 * The confirm for a Defend that is not paid the normal way: a free Defend when
 * the Defend is used this round (Core:1470), or a second Defend with no action
 * left. Asked before anything is paid.
 */
async function confirmOtherDefend(
	actor: Actor.Implementation,
	combatant: Combatant.Implementation | null,
	way: DefendRecordWay,
): Promise<boolean> {
	if (!game.combat?.started || !combatant) return true;
	const spent = way === 'free' && defendSpent(combatant);
	const actions = Number(foundry.utils.getProperty(combatant, 'system.actions.base.current') ?? 0);
	const noActions = way === 'extra' && actions < costOf(actor, ['defend']);
	if (!spent && !noActions) return true;
	const name = getHeroicReactionLabel('defend');
	return showReactionConfirmation({
		reactionName: name,
		spentReactionNames: spent ? name : '',
		noActions,
		hasSpentReactions: spent,
		isActiveTurn: false,
	});
}

/** A free Defend still uses the Defend for the round. */
async function markDefendUsed(
	combat: ReactionCombat | null,
	combatant: Combatant.Implementation | null,
): Promise<void> {
	if (!combat?.started || !combatant?.id) return;
	await combat.updateEmbeddedDocuments('Combatant', [
		{ _id: combatant.id, ...getHeroicReactionAvailabilityUpdate('defend', false) },
	]);
}

/** Use the card's reroll of the option's item, for the Defended token. */
async function useOptionReroll(
	card: NimbleChatMessage,
	pick: DefendOptionPick,
	token: string,
	quiet = false,
): Promise<void> {
	const entry = cardRerollFor(
		game.messages?.get(card.id ?? '') ?? card,
		pick.rule.item?.uuid,
		token,
	);
	if (!entry) {
		if (!quiet) ui.notifications?.warn(localize(`${TEXT}.rerollNotFound`, { label: pick.label }));
		return;
	}
	await requestIncomingAttackReaction({ messageId: card.id ?? '', entryId: entry.id });
}

/**
 * Use the row's item (a spell: its own mana and action). Returns how many steps
 * it was upcast, or null when the player stops.
 */
async function useRowItem(
	actor: Actor.Implementation,
	pick: DefendOptionPick,
): Promise<number | null> {
	const itemId = pick.rule.item?.id;
	if (!itemId) return null;
	const activate = (actor as { activateItem?: (id: string) => Promise<unknown> }).activateItem;
	const result = (await activate?.call(actor, itemId)) as
		| { system?: { upcast?: { upcastSteps?: number } | null } }
		| null
		| undefined;
	if (!result) return null;
	return Math.max(0, Math.floor(Number(result.system?.upcast?.upcastSteps) || 0));
}

/**
 * Open the Defend window for one hero on an attack card, then do what the player
 * picked. `way` picks its first row. Returns true when the hero reacted.
 */
export async function openDefendWindow(
	card: NimbleChatMessage,
	actor: Actor.Implementation,
	way: DefendWay | null = null,
): Promise<boolean> {
	const reactor = defendReactors(card as never).find((each) => each.actor.uuid === actor.uuid);
	if (!reactor || reactor.defend) return false;

	const plan = defendWindowPlan(card, reactor);
	const { data } = plan;
	if (way) data.picked = firstOf(data, way);
	const dialog = new ChoiceDialog<DefendChoice>(actor, {
		component: DefendDialog,
		icon: 'fa-solid fa-shield-halved',
		title: localize('NIMBLE.chat.defend.windowTitle', { name: actor.name ?? '' }),
		data: { data },
	});
	await dialog.render(true);
	const choice = await dialog.promise;
	if (choice && !game.user?.isGM && !getPrimaryActiveGmId()) {
		ui.notifications?.warn(localize('NIMBLE.chat.defend.refused.noGm'));
		return false;
	}
	const row = choice ? plan.rows.get(choice.optionId) : undefined;
	const option = choice ? data.options.find((each) => each.id === choice.optionId) : undefined;
	if (!choice || !row || !option || (!option.defend && !option.interposeEntryId)) return false;

	const combat = (game.combat ?? null) as ReactionCombat | null;
	const entry = option.interposeEntryId
		? reactor.interposes.find((each) => each.id === option.interposeEntryId)
		: null;
	if (option.interposeEntryId && !entry) return false;
	const defendedToken = entry ? entry.tokenUuid || null : reactor.targetTokenUuid;
	const combatant = combatantOf(combat, actor, defendedToken);
	const paysDefend = option.defend && (row.way === 'action' || row.way === 'extra');
	const keys: HeroicReactionKey[] = [
		...(entry?.source === 'baseline' ? (['interpose'] as const) : []),
		...(paysDefend && row.way === 'action' ? (['defend'] as const) : []),
	];
	const limits = await confirmLimits(combat, combatant, keys);
	if (!limits) return false;
	if (option.defend && !(await confirmOtherDefend(actor, combatant, row.way))) return false;

	if (entry) {
		if (entry.source === 'baseline' && !(await spendBaselineInterpose(entry, limits))) {
			return false;
		}
		const sent = await requestIncomingAttackReaction({
			messageId: card.id ?? '',
			entryId: entry.id,
		});
		if (!sent) return false;
		if (!option.defend) return true;
		if (defendedToken && !(await waitForTarget(card, defendedToken))) return true;
	}

	if (!option.defend || !defendedToken) return Boolean(entry);

	const uses: DefendOptionUse[] = [];
	let previousActions: number | null = null;
	let reactionKeys: string[] = [];
	let upcastArmor = 0;
	if (paysDefend) {
		const paid = await spendDefend(combat, combatant, limits.force || row.way === 'extra');
		if (!paid) return Boolean(entry);
		previousActions = paid.previousActions;
		reactionKeys = ['defend'];
	} else if (row.way === 'free' && row.pick) {
		if (row.pick.rule.useItem) {
			const steps = await useRowItem(actor, row.pick);
			if (steps === null) return Boolean(entry);
			upcastArmor = steps * Math.max(0, Number(row.pick.rule.upcastArmor) || 0);
			uses.push(defendOptionUse(actor, row.pick));
		} else {
			const use = await payDefendOption(actor, row.pick);
			if (!use) return Boolean(entry);
			uses.push(use);
		}
		await markDefendUsed(combat, combatant);
		reactionKeys = ['defend'];
	}

	const tickPicks = option.takesTicks ? choice.ticks.flatMap((id) => plan.ticks.get(id) ?? []) : [];
	const usedTicks: DefendOptionPick[] = [];
	for (const pick of tickPicks) {
		if (pick.rule.useReroll) {
			uses.push(defendOptionUse(actor, pick));
			usedTicks.push(pick);
			continue;
		}
		const use = await payDefendOption(actor, pick);
		if (!use) continue;
		uses.push(use);
		usedTicks.push(pick);
	}

	const effect = row.whole
		? effectOf(row, [])
		: defendOptionEffect([
				...(row.pick ? [row.pick.rule] : []),
				...usedTicks.map((pick) => pick.rule),
			]);
	await requestDefend({
		messageId: card.id ?? '',
		tokenUuid: defendedToken,
		actorUuid: actor.uuid ?? '',
		armor: armorOf(actor),
		label: row.whole?.label ?? row.pick?.label ?? '',
		combatantId: combatant?.id ?? '',
		previousActions,
		reactionKeys,
		outcome: effect.outcome,
		armorBonus: effect.armorBonus + upcastArmor,
		options: uses,
		reminders: effect.reminders,
		attackerConditions: effect.attackerConditions,
		way: row.way,
		wholeRound: effect.wholeRound,
	});

	const rerolls = [...(row.pick ? [row.pick] : []), ...usedTicks].filter(
		(each) => each.rule.useReroll,
	);
	// A free row works without its reroll (the attack may not offer it); a tick
	// shows only when the reroll is on the card.
	for (const pick of rerolls) {
		await useOptionReroll(card, pick, defendedToken, pick === row.pick);
	}
	return true;
}

/**
 * Open the Defend window on the newest attack card of the running combat where the
 * hero can react in that way. Returns null when there is no such card.
 */
export async function openDefendWindowOnNewestCard(
	actor: Actor.Implementation,
	way: DefendWay,
): Promise<boolean | null> {
	const combat = game.combat;
	if (!combat?.started) return null;
	const since = Number(foundry.utils.getProperty(combat, '_stats.createdTime') ?? 0);
	const cards = (game.messages?.contents ?? []) as unknown as NimbleChatMessage[];
	const card = newestDefendCard(cards, actor, way, since);
	return card ? openDefendWindow(card, actor, way) : null;
}
