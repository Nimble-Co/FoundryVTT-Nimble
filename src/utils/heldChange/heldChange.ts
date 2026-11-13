import { SYSTEM_ID } from '#system';
import type { HeldChange, HeldChangeData, HeldChangeEnd } from '#types/heldChange.d.ts';
import { askActiveGm } from '#utils/askActiveGm.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';
import { type AttackDelivery, attackDeliveryFromAttackType } from '../damage/attackDelivery.js';

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
	type?: string;
	disabled?: boolean;
	heldKind?: HeldChangeData['kind'];
	value?: number;
	whichRoll?: HeldChangeData['appliesTo'];
	usedUp?: boolean;
	meleeOnly?: boolean;
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
	isOwner?: boolean;
	effects?: Iterable<HolderEffect>;
	createEmbeddedDocuments?(type: string, data: object[]): Promise<unknown>;
	deleteEmbeddedDocuments?(type: string, ids: string[]): Promise<unknown>;
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
		const messageId = effect.flags?.[SYSTEM_ID]?.[MESSAGE_FLAG];
		for (const rule of rules) {
			held.push({
				kind: rule.heldKind ?? 'advantage',
				value: Number(rule.value ?? 1),
				label: effect.name ?? '',
				sourceName: origin.name || effect.name || '',
				appliesTo: rule.whichRoll ?? 'holderAttacks',
				spentBy: rule.usedUp === false ? 'everyRoll' : 'oneRoll',
				meleeOnly: rule.meleeOnly === true,
				onlyFromUuid: rule.fromSourceOnly ? (origin.creatureUuid ?? '') : null,
				...(rule.damageType ? { damageType: rule.damageType } : {}),
				...(rule.formula ? { formula: rule.formula } : {}),
				...(typeof messageId === 'string' ? { sourceMessageId: messageId } : {}),
				effectId: effect.id,
				holderUuid: holder?.uuid ?? '',
			});
		}
	}
	return held;
}

/** The change can go on an attack by `attacker`, melee or not. */
function fitsAttack(
	held: HeldChange,
	attacker: Holder | null | undefined,
	melee: boolean | undefined,
): boolean {
	if (held.meleeOnly && melee === false) return false;
	// A lost source ('') fits no attacker.
	return held.onlyFromUuid === null || held.onlyFromUuid === attacker?.uuid;
}

interface AttackInput {
	attacker: Holder | null | undefined;
	target: Holder | null | undefined;
	/** An area attack: a change on a target does not go on it. */
	area: boolean;
	/** A melee attack; unknown counts as melee. */
	melee?: boolean;
}

/** The attacker's own changes of `kind`, and those on the single target, that fit this attack. */
function changesForAttack(input: AttackInput, kind: HeldChangeData['kind']): HeldChange[] {
	const own = heldChangesOn(input.attacker).filter((held) => held.appliesTo === 'holderAttacks');
	const onTarget = input.area
		? []
		: heldChangesOn(input.target).filter((held) => held.appliesTo === 'attacksOnHolder');
	return [...own, ...onTarget].filter(
		(held) => held.kind === kind && fitsAttack(held, input.attacker, input.melee),
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

/** The change that makes every die of the attack roll its highest number, from the single target. */
export function heldMaximizeForAttack(input: AttackInput): HeldChange | null {
	if (input.area) return null;
	return changesForAttack(input, 'maximize')[0] ?? null;
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

/** The one-use vulnerability of a creature to this damage type. */
export function heldVulnerabilityTo(
	holder: Holder | null | undefined,
	damageType: string | undefined,
): HeldChange | null {
	if (!damageType) return null;
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

/** The read-only lines of a roll window. */
export function heldLines(held: HeldChange[]) {
	return held.map((change) => ({
		key: `${change.holderUuid}.${change.effectId}`,
		text: lineText(change),
		source: localize(
			`NIMBLE.heldChange.line.${change.spentBy === 'oneRoll' ? 'spends' : 'stays'}`,
			{
				source: change.sourceName,
			},
		),
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

/** The lines for the roll window of an item, with what is targeted now. */
export function heldLinesForItem(
	attacker: Holder | null | undefined,
	item: ActivatedItem,
	options: { ignoresDisadvantage?: boolean } = {},
) {
	const activation = item.system?.activation;
	const node = firstDamageNode(activation?.effects);
	const ended = keptAmountEndedBy(attacker, item);
	const mustAttack = node ? mustAttackOtherChange(attacker) : null;
	const endedLines = ended
		? [
				{
					key: ended.effectId,
					text: localize('NIMBLE.heldChange.line.wholeAmountEnds', {
						label: ended.label,
						value: String(ended.value),
					}),
					source: localize('NIMBLE.heldChange.line.endsSource', { source: ended.sourceName }),
				},
			]
		: [];
	const mustAttackLines = heldLines(mustAttack ? [mustAttack] : []);
	if (!activation || !isAttackRoll(activation.targets?.attackType, node)) {
		return [...mustAttackLines, ...endedLines];
	}
	const ignore = options.ignoresDisadvantage ? null : ignoreDisadvantageChange(attacker);
	const attack = {
		attacker,
		target: firstTargetActor(),
		area: !!activation.acquireTargetsFromTemplate && !!activation.template?.shape,
		melee: isMelee(attackDeliveryFromAttackType(activation.targets?.attackType)),
	};
	const maximize = heldMaximizeForAttack(attack);
	return [
		...mustAttackLines,
		...endedLines,
		...heldLines([
			...(ignore ? [ignore] : []),
			...heldAdvantageForAttack(attack),
			...(maximize ? [maximize] : []),
			...heldChangesForAttack({ ...attack, ignoresNegative: !!ignore }),
			...heldExtraDamageForAttack(attack),
		]),
	];
}

/** Melee, ranged, or unknown (an attack with no attack type). */
export function isMelee(delivery: AttackDelivery): boolean | undefined {
	return delivery === null ? undefined : delivery === 'melee';
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

async function deleteHere(holder: Holder, effectId: string): Promise<void> {
	await holder.deleteEmbeddedDocuments?.('ActiveEffect', [effectId]);
}

async function deleteHeld(holder: Holder, effectId: string): Promise<void> {
	if (holder.isOwner) await deleteHere(holder, effectId);
	else await askActiveGm(QUERY_NAME, { action: 'delete', actorUuid: holder.uuid, effectId });
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

/** Removes what a roll spent. A change that stays for every roll is not spent. */
export async function spendHeldChanges(held: HeldChange[]): Promise<void> {
	for (const change of held) {
		if (change.spentBy !== 'oneRoll') continue;
		const holder = fromUuidSync(change.holderUuid) as unknown as Holder | null;
		if (!holder) continue;
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
	for (const id of ids) await deleteHeld(holder, id);
	return ids.size;
}

/** It lasts for the next action. An attack spends it at its roll; any other action spends it here. */
export async function spendHeldIgnoreDisadvantage(
	holder: Holder,
	usedItemName?: string | null,
): Promise<void> {
	const held = ignoreDisadvantageChange(holder);
	if (held && held.label !== usedItemName) await spendHeldChanges([held]);
}

export function registerHeldChangeQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: {
			action: 'create' | 'delete';
			actorUuid: string;
			change?: HeldChangeData;
			effectId?: string;
		}) => {
			const holder = fromUuidSync(data.actorUuid) as unknown as Holder | null;
			if (!holder) return false;
			if (data.action === 'create' && data.change) await createHere(holder, data.change);
			if (data.action === 'delete' && data.effectId) await deleteHere(holder, data.effectId);
			return true;
		};
	});
}
