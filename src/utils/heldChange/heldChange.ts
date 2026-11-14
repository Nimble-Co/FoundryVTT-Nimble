import { SYSTEM_ID } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';
import type { HeldChange, HeldChangeData, HeldChangeEnd } from '#types/heldChange.d.ts';
import { formulaWithStacks, stacksOf, UNDO_APPLICATION_OPTION } from '#utils/actor/effectStacks.js';
import { askActiveGm } from '#utils/askActiveGm.js';
import { endedEffectRow } from '#utils/lastsUntil/endEffects.js';
import { endedEffectEvent } from '#utils/lastsUntil/endedEffectEvent.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import {
	type AttackDelivery,
	deliveryOfAttack,
	matchesAttackDelivery,
} from '../damage/attackDelivery.js';

const QUERY_NAME = `${SYSTEM_ID}.heldChange`;
const MESSAGE_FLAG = 'heldChangeMessage';
const SHOW_ICON_ALWAYS = 2;

const ICONS: Record<HeldChangeData['kind'], string> = {
	advantage: 'icons/svg/upgrade.svg',
	primaryDie: 'icons/svg/target.svg',
	wholeAmount: 'icons/svg/sword.svg',
	ignoreDisadvantage: 'icons/svg/aura.svg',
	mustAttackOther: 'icons/svg/daze.svg',
	vulnerableOnce: 'icons/svg/fire.svg',
	maximize: 'icons/svg/dice-target.svg',
	extraDamage: 'icons/svg/explosion.svg',
};

const NO_MOMENT = {
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
} as const;

/** The Lasts Until of a Held Change that code makes. */
export function heldChangeMoments(ends: HeldChangeEnd): Moment[] {
	if (ends === 'combat') return [{ ...NO_MOMENT, kind: 'event', event: 'combatEnd' }];
	if (ends === 'round') {
		return [{ ...NO_MOMENT, kind: 'turn', boundary: 'end', span: 'currentRound' }];
	}
	return [{ ...NO_MOMENT, kind: 'turn', boundary: 'end', clock: 'any', span: 'currentTurn' }];
}

interface HeldRollSource {
	id?: string;
	type?: string;
	disabled?: boolean;
	heldKind?: HeldChangeData['kind'];
	value?: number;
	whichRoll?: HeldChangeData['appliesTo'];
	usedUp?: boolean;
	meleeOnly?: boolean;
	rangedOnly?: boolean;
	fromSourceOnly?: boolean;
	damageType?: string;
	formula?: string;
	/** The prepared rule's predicate check; a source with no rule instance has none. */
	appliesTo?: unknown;
}

interface HolderEffect {
	id?: string | null;
	name?: string | null;
	origin?: string | null;
	disabled?: boolean;
	active?: boolean;
	system?: unknown;
	/** The prepared rules of the effect. */
	rules?: { values(): Iterable<unknown> } | null;
	flags?: Record<string, Record<string, unknown> | undefined>;
}

interface Holder {
	uuid?: string | null;
	type?: string | null;
	isOwner?: boolean;
	effects?: Iterable<HolderEffect>;
	createEmbeddedDocuments?(type: string, data: object[]): Promise<unknown>;
	deleteEmbeddedDocuments?(type: string, ids: string[], options?: object): Promise<unknown>;
}

/** The creature that applied the effect, and the name of what made it. */
function originOf(effect: HolderEffect): { creatureUuid: string | null; name: string } {
	if (!effect.origin) return { creatureUuid: null, name: '' };
	const document = fromUuidSync(effect.origin as never, { strict: false }) as {
		uuid?: string;
		name?: string;
		documentName?: string;
		actor?: { uuid?: string } | null;
	} | null;
	const creatureUuid =
		document?.documentName === 'Actor' ? (document.uuid ?? null) : (document?.actor?.uuid ?? null);
	return { creatureUuid, name: document?.name ?? '' };
}

/** The Held Roll rules of an effect whose predicate passes. A prepared rule checks it; a source rule has none to check. */
function heldRollsOf(effect: HolderEffect, all: boolean): HeldRollSource[] {
	const prepared = effect.rules && typeof effect.rules.values === 'function';
	const rules = (
		prepared
			? [...(effect.rules as { values(): Iterable<unknown> }).values()]
			: ((effect.system as { rules?: unknown[] } | undefined)?.rules ?? [])
	) as HeldRollSource[];
	if (!Array.isArray(rules)) return [];
	return rules.filter(
		(rule) =>
			rule?.type === 'heldRoll' &&
			(all ||
				(!rule.disabled && (typeof rule.appliesTo !== 'function' || rule.appliesTo() !== false))),
	);
}

/**
 * Every Held Change on a creature: each Held Roll rule of an active effect on it. With `all`, also
 * the rules of a disabled effect and the rules that are off, so a take-back finds them.
 */
function heldChangesOn(holder: Holder | null | undefined, all = false): HeldChange[] {
	const held: HeldChange[] = [];
	for (const effect of holder?.effects ?? []) {
		if (!effect.id) continue;
		if (!all && (effect.disabled || effect.active === false)) continue;
		const rules = heldRollsOf(effect, all);
		if (!rules.length) continue;
		const origin = originOf(effect);
		const stacks = stacksOf(effect.system)?.count ?? 1;
		const messageId = effect.flags?.[SYSTEM_ID]?.[MESSAGE_FLAG];
		for (const [index, rule] of rules.entries()) {
			held.push({
				kind: rule.heldKind ?? 'advantage',
				value: Number(rule.value ?? 1),
				label: effect.name ?? '',
				sourceName: origin.name || effect.name || '',
				appliesTo: rule.whichRoll ?? 'holderAttacks',
				spentBy: rule.usedUp === false ? 'everyRoll' : 'oneRoll',
				meleeOnly: rule.meleeOnly === true,
				...(rule.rangedOnly && !rule.meleeOnly ? { rangedOnly: true } : {}),
				onlyFromUuid: rule.fromSourceOnly ? (origin.creatureUuid ?? '') : null,
				...(rule.damageType ? { damageType: rule.damageType } : {}),
				...(rule.formula ? { formula: formulaWithStacks(rule.formula, stacks) } : {}),
				...(typeof messageId === 'string' ? { sourceMessageId: messageId } : {}),
				effectId: effect.id,
				ruleId: rule.id || String(index),
				holderUuid: holder?.uuid ?? '',
			});
		}
	}
	return held;
}

/** The change can go on an attack by `attacker` with this delivery. Melee-only wins over ranged-only. */
function fitsAttack(
	held: HeldChange,
	attacker: Holder | null | undefined,
	delivery: AttackDelivery | undefined,
): boolean {
	const filter = held.meleeOnly ? 'melee' : held.rangedOnly ? 'ranged' : 'any';
	if (!matchesAttackDelivery(filter, delivery ?? null)) return false;
	// A lost source ('') fits no attacker.
	return held.onlyFromUuid === null || held.onlyFromUuid === attacker?.uuid;
}

interface AttackInput {
	attacker: Holder | null | undefined;
	target: Holder | null | undefined;
	/** An area attack: a change on a target does not go on it. */
	area: boolean;
	/** How the attack is delivered (`deliveryOfAttack`); none fits no melee-only or ranged-only change. */
	delivery?: AttackDelivery;
}

/** The attacker's own changes of `kind`, and those on the single target, that fit this attack. */
function changesForAttack(input: AttackInput, kind: HeldChangeData['kind']): HeldChange[] {
	const own = heldChangesOn(input.attacker).filter((held) => held.appliesTo === 'holderAttacks');
	const onTarget = input.area
		? []
		: heldChangesOn(input.target).filter((held) => held.appliesTo === 'attacksOnHolder');
	return [...own, ...onTarget].filter(
		(held) => held.kind === kind && fitsAttack(held, input.attacker, input.delivery),
	);
}

/**
 * The Primary Die changes one attack roll uses: the attacker's own, and those
 * on the target. An area roll has no Primary Die.
 */
export function heldChangesForAttack(
	input: AttackInput & {
		/** The roll spends a change that ignores negative effects. */
		ignoresNegative?: boolean;
	},
): HeldChange[] {
	if (input.area) return [];
	return changesForAttack(input, 'primaryDie').filter(
		(held) => !(input.ignoresNegative && held.value < 0),
	);
}

/** The advantage changes one attack uses. A change on the target needs a single target. */
export function heldAdvantageForAttack(input: AttackInput): HeldChange[] {
	return changesForAttack(input, 'advantage');
}

/** The extra damage changes one attack uses. Each one is a damage part that counts only on a hit. */
export function heldExtraDamageForAttack(input: AttackInput): HeldChange[] {
	return changesForAttack(input, 'extraDamage').filter((held) => !!held.formula?.trim());
}

/** The key of a change: one Held Roll rule of one effect on one creature. */
export function heldChangeKey(change: HeldChange): string {
	return `${change.holderUuid}.${change.effectId}.${change.ruleId}`;
}

/** The change that makes every die of the attack roll its highest number, from the single target. */
export function heldMaximizeForAttack(input: AttackInput): HeldChange | null {
	if (input.area) return null;
	return changesForAttack(input, 'maximize')[0] ?? null;
}

/**
 * The change on one target of an area attack that maximizes the roll against it. The area rolls
 * once, so only this target takes the highest total; it is spent when the damage is applied.
 * With Feature Effects off no roll window can tick it, so it does not apply.
 */
export function heldMaximizeOnAreaTarget(
	target: Holder | null | undefined,
	attacker: Holder | null | undefined,
	delivery: AttackDelivery,
): HeldChange | null {
	if (!isRuleAutomationEnabled()) return null;
	return (
		heldChangesOn(target).find(
			(held) =>
				held.kind === 'maximize' &&
				held.appliesTo === 'attacksOnHolder' &&
				fitsAttack(held, attacker, delivery),
		) ?? null
	);
}

/** The change that takes disadvantage out of the holder's next roll. */
export function ignoreDisadvantageChange(attacker: Holder | null | undefined): HeldChange | null {
	return (
		heldChangesOn(attacker).find(
			(held) => held.kind === 'ignoreDisadvantage' && held.appliesTo === 'holderAttacks',
		) ?? null
	);
}

/** The change that says who the holder's next attack must be against. It only reports. */
export function mustAttackOtherChange(attacker: Holder | null | undefined): HeldChange | null {
	return heldChangesOn(attacker).find((held) => held.kind === 'mustAttackOther') ?? null;
}

/** The one-use vulnerability of a creature to this damage type. With Feature Effects off no roll window can tick it. */
export function heldVulnerabilityTo(
	holder: Holder | null | undefined,
	damageType: string | undefined,
): HeldChange | null {
	if (!damageType || !isRuleAutomationEnabled()) return null;
	return (
		heldChangesOn(holder).find(
			(held) => held.kind === 'vulnerableOnce' && held.damageType === damageType,
		) ?? null
	);
}

/** Advantage steps below 0 are disadvantage. */
function lineText(change: HeldChange): string {
	if (change.kind === 'extraDamage') {
		const types = CONFIG.NIMBLE?.damageTypes as Record<string, string> | undefined;
		const type = change.damageType ? (types?.[change.damageType] ?? change.damageType) : '';
		return localize('NIMBLE.heldChange.line.extraDamage', {
			label: change.label,
			formula: change.formula ?? '',
			damageType: type ? localize(type) : '',
		});
	}
	if (change.kind === 'advantage' && change.value < 0) {
		return localize('NIMBLE.heldChange.line.disadvantage', {
			label: change.label,
			value: String(-change.value),
		});
	}
	return localize(`NIMBLE.heldChange.line.${change.kind}`, {
		label: change.label,
		value: change.value > 0 ? `+${change.value}` : String(change.value),
	});
}

function spendWord(change: HeldChange, choosing: boolean): string {
	if (change.spentBy !== 'oneRoll') return 'stays';
	return choosing ? 'spendsIfTicked' : 'spends';
}

/** A line of a roll window. A line that changes the roll mode has its step. */
export interface HeldLine {
	key: string;
	text: string;
	source: string;
	rollMode?: number;
}

/** The lines of a roll window. With `choosing`, the player ticks each line the roll uses. */
export function heldLines(held: HeldChange[], choosing = false): HeldLine[] {
	return held.map((change) => ({
		key: heldChangeKey(change),
		...(change.kind === 'advantage' && change.value !== 0 ? { rollMode: change.value } : {}),
		text: lineText(change),
		source: localize(`NIMBLE.heldChange.line.${spendWord(change, choosing)}`, {
			source: change.sourceName,
		}),
	}));
}

interface AttackNodeLike {
	type?: string;
	canCrit?: boolean;
	canMiss?: boolean;
}

/** A damage roll with an attack type or that can crit or miss is an attack roll. */
export function isAttackRoll(attackType: string | undefined, node: AttackNodeLike | undefined) {
	return Boolean(attackType || node?.canCrit || node?.canMiss);
}

function firstDamageNode(effects: unknown[] | undefined): AttackNodeLike | undefined {
	return (flattenEffectsTree((effects ?? []) as never) as AttackNodeLike[]).find(
		(node) => node.type === 'damage',
	);
}

interface ActivatedItem {
	system?: {
		activation?: {
			effects?: AttackNodeLike[];
			acquireTargetsFromTemplate?: boolean;
			template?: { shape?: string };
			targets?: { attackType?: string };
		};
	};
}

/**
 * The lines for the roll window of an item, with what is targeted now. With `choosing` (Feature
 * Effects off) the player ticks each change, so the minus Primary Die changes show even next to a
 * change that ignores them.
 */
export function heldLinesForItem(
	attacker: Holder | null | undefined,
	item: ActivatedItem,
	options: { ignoresDisadvantage?: boolean; choosing?: boolean } = {},
): HeldLine[] {
	const choosing = options.choosing === true;
	const activation = item.system?.activation;
	const node = firstDamageNode(activation?.effects);
	const ended = keptAmountEndedBy(attacker, item);
	const mustAttack = node ? mustAttackOtherChange(attacker) : null;
	const endedLines = ended
		? [
				{
					key: heldChangeKey(ended),
					text: localize('NIMBLE.heldChange.line.wholeAmountEnds', {
						label: ended.label,
						value: String(ended.value),
					}),
					source: localize(`NIMBLE.heldChange.line.${choosing ? 'endsIfTicked' : 'endsSource'}`, {
						source: ended.sourceName,
					}),
				},
			]
		: [];
	const mustAttackLines = heldLines(mustAttack ? [mustAttack] : [], choosing);
	if (!activation || !isAttackRoll(activation.targets?.attackType, node)) {
		return [...mustAttackLines, ...endedLines];
	}
	const ignore = options.ignoresDisadvantage ? null : ignoreDisadvantageChange(attacker);
	const attack = {
		attacker,
		target: firstTargetActor(),
		area: !!activation.acquireTargetsFromTemplate && !!activation.template?.shape,
		delivery: deliveryOfAttack(activation, attacker),
	};
	const maximize = heldMaximizeForAttack(attack);
	return [
		...mustAttackLines,
		...endedLines,
		...heldLines(
			[
				...(ignore ? [ignore] : []),
				...heldAdvantageForAttack(attack),
				...(maximize ? [maximize] : []),
				...heldChangesForAttack({ ...attack, ignoresNegative: !!ignore && !choosing }),
				...heldExtraDamageForAttack(attack),
			],
			choosing,
		),
	];
}

/** The amount the holder keeps for its next attack. Any damage that can harm is an attack (C:452); an area does not use it. */
export function keptAmountFor(
	attacker: Holder | null | undefined,
	item: ActivatedItem,
): HeldChange | null {
	const activation = item.system?.activation;
	const node = firstDamageNode(activation?.effects);
	if (!activation || !node) return null;
	if (activation.acquireTargetsFromTemplate && activation.template?.shape) return null;
	return (
		heldChangesOn(attacker).find(
			(held) => held.kind === 'wholeAmount' && held.appliesTo === 'holderAttacks',
		) ?? null
	);
}

/** An area attack (C:1403) is the next attack: it rolls as normal, does not use the amount, and ends it. */
export function keptAmountEndedBy(
	attacker: Holder | null | undefined,
	item: ActivatedItem,
): HeldChange | null {
	const activation = item.system?.activation;
	if (!activation?.acquireTargetsFromTemplate || !activation.template?.shape) return null;
	if (!firstDamageNode(activation.effects)) return null;
	return (
		heldChangesOn(attacker).find(
			(held) => held.kind === 'wholeAmount' && held.appliesTo === 'holderAttacks',
		) ?? null
	);
}

interface DamageNodeLike extends AttackNodeLike {
	roll?: { total?: number } | null;
	damageMultiplier?: number;
}

/** The damage total a card shows: each rolled damage node and the spends folded in. */
export function cardDamageTotal(system: {
	activation?: { effects?: unknown[] };
	incomingReactions?: Array<{ used?: boolean; kind?: string; usedAmount?: number }>;
}): number {
	const nodes = flattenEffectsTree((system.activation?.effects ?? []) as never) as DamageNodeLike[];
	const rolled = nodes
		.filter((node) => node.type === 'damage')
		.reduce((sum, node) => sum + (Number(node.roll?.total) || 0) * (node.damageMultiplier ?? 1), 0);
	const folded = (system.incomingReactions ?? [])
		.filter((entry) => entry.kind === 'spendPoolForDamage' && entry.used)
		.reduce((sum, entry) => sum + (entry.usedAmount ?? 0), 0);
	return rolled + folded;
}

/** Holds the amount for the next attack of the holder. It ends with the turn. */
export async function keepAmount(
	holder: Holder,
	label: string,
	amount: number,
	origin?: string | null,
): Promise<void> {
	await createHeldChange(holder, {
		kind: 'wholeAmount',
		value: amount,
		label,
		appliesTo: 'holderAttacks',
		spentBy: 'oneRoll',
		ends: 'turn',
		origin: origin ?? null,
	});
}

/** The first creature targeted. It decides what applies on a multi-target attack. */
export function firstTargetActor(): Holder | null {
	const [first] = Array.from(game.user?.targets ?? []) as unknown as Array<{ actor?: Holder }>;
	return first?.actor ?? null;
}

/** The effect of a Held Change that code makes: a Held Roll rule, and its time as Lasts Until. */
export function heldChangeEffect(change: HeldChangeData): Record<string, unknown> {
	return {
		type: NIMBLE_EFFECT_TYPE,
		name: change.label,
		img: ICONS[change.kind],
		disabled: false,
		showIcon: SHOW_ICON_ALWAYS,
		origin: change.origin ?? null,
		system: {
			lastsUntil: heldChangeMoments(change.ends),
			rules: [
				{
					id: foundry.utils.randomID(),
					type: 'heldRoll',
					label: change.label,
					heldKind: change.kind,
					value: change.value,
					whichRoll: change.appliesTo,
					usedUp: change.spentBy === 'oneRoll',
					...(change.damageType ? { damageType: change.damageType } : {}),
					...(change.formula ? { formula: change.formula } : {}),
				},
			],
		},
		...(change.sourceMessageId
			? { flags: { [SYSTEM_ID]: { [MESSAGE_FLAG]: change.sourceMessageId } } }
			: {}),
	};
}

async function createHere(holder: Holder, change: HeldChangeData): Promise<void> {
	await holder.createEmbeddedDocuments?.('ActiveEffect', [heldChangeEffect(change)]);
}

/** `undo`: the delete takes back the card's application, so the change does not end. */
async function deleteHere(holder: Holder, effectId: string, undo = false): Promise<void> {
	if (!undo) await holder.deleteEmbeddedDocuments?.('ActiveEffect', [effectId]);
	else {
		await holder.deleteEmbeddedDocuments?.('ActiveEffect', [effectId], {
			[UNDO_APPLICATION_OPTION]: true,
		});
	}
}

async function deleteHeld(holder: Holder, effectId: string, undo = false): Promise<void> {
	if (holder.isOwner) await deleteHere(holder, effectId, undo);
	else {
		await askActiveGm(QUERY_NAME, {
			action: 'delete',
			actorUuid: holder.uuid,
			effectId,
			...(undo ? { undo } : {}),
		});
	}
}

/**
 * Puts a Held Change on a creature. A player without ownership asks the GM.
 * Outside combat nothing would end it, so nothing is held.
 */
export async function createHeldChange(holder: Holder, change: HeldChangeData): Promise<void> {
	if (!game.combat?.started) return;
	if (holder.isOwner) return createHere(holder, change);
	await askActiveGm(QUERY_NAME, { action: 'create', actorUuid: holder.uuid, change });
}

/** The lines of the use whose roll spends the changes. */
interface SpendLines {
	add(events: CardEvent[]): Promise<boolean>;
}

const USED_BY_ROLL = 'NIMBLE.chat.events.cause.usedUp';
const USED_BY_ACTION = 'NIMBLE.chat.events.cause.usedByAction';

function usedUpLine(change: HeldChange, cause: string): CardEvent | null {
	const uuid = `${change.holderUuid}.ActiveEffect.${change.effectId}`;
	const effect = fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as ActiveEffect | null;
	if (!effect) return null;
	return endedEffectEvent(endedEffectRow(effect), Date.now(), { key: cause });
}

/**
 * Removes what a roll spent. A change that stays for every roll is not spent. With `lines`, each
 * spent change is an ended line, with Undo, on the card of the use; `cause` says what used it.
 * Two spent rules of one effect delete it once.
 */
export async function spendHeldChanges(
	held: HeldChange[],
	lines: SpendLines | null = null,
	cause = USED_BY_ROLL,
): Promise<void> {
	const spent = new Set<string>();
	for (const change of held) {
		if (change.spentBy !== 'oneRoll') continue;
		const effectKey = `${change.holderUuid}.${change.effectId}`;
		if (spent.has(effectKey)) continue;
		spent.add(effectKey);
		const holder = fromUuidSync(change.holderUuid) as unknown as Holder | null;
		if (!holder) continue;
		const line = lines ? usedUpLine(change, cause) : null;
		if (line) await lines?.add([line]);
		await deleteHeld(holder, change.effectId);
	}
}

/** Removes the changes that one card made on a creature, and says how many there were. */
export async function takeBackHeldChanges(
	holder: Holder,
	sourceMessageId: string,
): Promise<number> {
	const ids = new Set(
		heldChangesOn(holder, true)
			.filter((held) => held.sourceMessageId === sourceMessageId)
			.map((held) => held.effectId),
	);
	for (const id of ids) await deleteHeld(holder, id, true);
	return ids.size;
}

/**
 * It lasts for the next action. An attack spends it at its roll; any other action spends it here.
 * With Feature Effects off only a tick in a roll window spends it.
 */
export async function spendHeldIgnoreDisadvantage(
	holder: Holder,
	usedItemName?: string | null,
	lines: SpendLines | null = null,
): Promise<void> {
	if (!isRuleAutomationEnabled()) return;
	const held = ignoreDisadvantageChange(holder);
	if (held && held.label !== usedItemName) await spendHeldChanges([held], lines, USED_BY_ACTION);
}

export function registerHeldChangeQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: {
			action: 'create' | 'delete';
			actorUuid: string;
			change?: HeldChangeData;
			effectId?: string;
			undo?: boolean;
		}) => {
			const holder = fromUuidSync(data.actorUuid) as unknown as Holder | null;
			if (!holder) return false;
			if (data.action === 'create' && data.change) await createHere(holder, data.change);
			if (data.action === 'delete' && data.effectId) {
				await deleteHere(holder, data.effectId, data.undo === true);
			}
			return true;
		};
	});
}
