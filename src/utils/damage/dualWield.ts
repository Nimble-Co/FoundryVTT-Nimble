import { SYSTEM_ID } from '#system';
import type {
	DualWieldChoice,
	DualWieldOffer,
	DualWieldWeapon,
	DualWieldWeaponSelf,
} from '#types/dualWield.d.ts';
import type { RerollRecord } from '../incomingReactions/incomingReactionEntry.js';

const FLAG = 'dualWieldRound';

interface WeaponItem {
	id?: string | null;
	uuid?: string;
	name?: string;
	type?: string;
	system?: {
		objectType?: string;
		equipped?: boolean;
		activation?: { effects?: Array<{ type?: string; formula?: string; damageType?: string }> };
	};
}

interface DualWieldActor {
	items?: Iterable<WeaponItem>;
	getFlag?(scope: string, key: string): unknown;
	update?(data: Record<string, unknown>): Promise<unknown>;
}

function currentRoundId(): string | null {
	const combat = game.combat;
	if (!combat?.started) return null;
	return `${combat.id}:${combat.round}`;
}

/** Whether the use of this round was spent. Outside combat there is no limit. */
function dualWieldUsedThisRound(actor: DualWieldActor | null | undefined): boolean {
	const round = currentRoundId();
	return !!round && actor?.getFlag?.(SYSTEM_ID, FLAG) === round;
}

export async function markDualWieldUse(actor: DualWieldActor | null | undefined): Promise<void> {
	const round = currentRoundId();
	if (round) await actor?.update?.({ [`flags.${SYSTEM_ID}.${FLAG}`]: round });
}

function firstDamage(item: WeaponItem) {
	return item.system?.activation?.effects?.find((effect) => effect.type === 'damage');
}

const sameFormula = (a: WeaponItem, b: WeaponItem) =>
	(firstDamage(a)?.formula ?? '').replace(/\s+/g, '').toLowerCase() ===
	(firstDamage(b)?.formula ?? '').replace(/\s+/g, '').toLowerCase();

const isEquippedWeapon = (item: WeaponItem) =>
	item.type === 'object' && item.system?.objectType === 'weapon' && item.system.equipped === true;

/**
 * The tick for this attack, with no check of Light or STR: an equipped weapon
 * with a second one, or an attack with no item, which is the Unarmed Strike.
 */
export function dualWieldOfferFor(
	actor: DualWieldActor | null | undefined,
	item: WeaponItem,
): DualWieldOffer | null {
	if (!actor) return null;
	const used = dualWieldUsedThisRound(actor);
	if (!item.uuid) return firstDamage(item) ? { other: null, used } : null;
	if (!isEquippedWeapon(item)) return null;

	const others = Array.from(actor.items ?? []).filter(
		(each) => each.id !== item.id && isEquippedWeapon(each) && !!firstDamage(each),
	);
	const [other] = others;
	if (!other) return null;
	return sameFormula(item, other)
		? { other: null, used }
		: { other: { uuid: other.uuid ?? '', name: other.name ?? '' }, used };
}

/** The weapon's Roll Mode: with advantage, one of the two weapons has the extra die. */
export function rollModeOfWeapon(
	rollMode: number,
	extraDieOn: DualWieldChoice['extraDieOn'],
	weapon: 'activated' | 'other',
): number {
	return rollMode > 0 && extraDieOn !== weapon ? rollMode - 1 : rollMode;
}

interface RollWithOptions {
	originalFormula?: string;
	formula?: string;
	options?: { dualWieldOther?: DualWieldWeapon; dualWieldSelf?: DualWieldWeaponSelf };
}

/** The new roll's options with the other weapon named, so a reroll can roll both again. */
export function dualWieldRollOptions(
	own: Record<string, unknown>,
	self: DualWieldWeaponSelf,
	other: DualWieldWeapon,
): Record<string, unknown> {
	return { ...own, dualWieldSelf: self, dualWieldOther: other };
}

/** The other weapon's formula and options, from the roll on the card, for a new roll of it. */
export function otherWeaponOf(roll: RollWithOptions): {
	formula: string;
	options: Record<string, unknown>;
} | null {
	const other = roll.options?.dualWieldOther;
	const self = roll.options?.dualWieldSelf;
	if (!other || !self) return null;
	const {
		dualWieldOther: _other,
		dualWieldSelf: _self,
		...own
	} = (roll.options ?? {}) as Record<string, unknown>;
	return {
		formula: other.formula,
		options: dualWieldRollOptions(
			other.options,
			{ itemUuid: other.itemUuid, label: other.label, damageType: other.damageType },
			{ ...self, formula: roll.originalFormula ?? roll.formula ?? '', options: own },
		),
	};
}

interface KeepRoll {
	total?: number | null;
	isCritical?: boolean;
	isMiss?: boolean;
	options?: { dualWieldSelf?: DualWieldWeaponSelf };
}

/** What a keep button says for one weapon. */
export function keepChoiceOfWeapon(roll: KeepRoll) {
	return {
		total: Number(roll.total) || 0,
		outcome: roll.isCritical
			? ('crit' as const)
			: roll.isMiss
				? ('miss' as const)
				: ('hit' as const),
		label: roll.options?.dualWieldSelf?.label ?? '',
	};
}

/** The record of the keep on the card: which weapon stays. */
export function dualWieldRecord(input: {
	entryId: string;
	actorUuid: string;
	itemUuid: string;
	label: string;
}): RerollRecord {
	return {
		entryId: input.entryId,
		itemUuid: input.itemUuid,
		ruleId: 'dualWield',
		label: input.label,
		actorUuid: input.actorUuid,
		faces: null,
		previous: null,
		next: null,
		usesLeft: null,
		woundsGained: 0,
		dropped: null,
		changes: [],
		use: 'effect',
		effect: 'dualWield',
	} as RerollRecord;
}

/** The used entry a keep needs on the card. */
export function dualWieldEntry(input: { actorUuid: string; itemUuid: string; label: string }) {
	return {
		id: foundry.utils.randomID(),
		kind: 'reroll' as const,
		source: 'rule' as const,
		actorUuid: input.actorUuid,
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller' as const,
		label: input.label,
		ruleId: 'dualWield',
		itemUuid: input.itemUuid,
		used: true,
		outcomeTrigger: 'always' as const,
		oncePerAttack: true,
		use: 'effect' as const,
		effect: 'dualWield' as const,
	};
}
