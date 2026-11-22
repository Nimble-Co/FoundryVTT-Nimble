import type { NimbleCharacter } from '#documents/actor/character.js';
import type { ExtraTargets } from '../../models/rules/extraTargets.js';
import type { GrantedWeaponKind } from '../../models/rules/grantActivation.js';
import { rulesOfType } from '../actor/actorRules.js';
import { attackOriginOf } from '../damage/attackOrigin.js';
import { groupWeapons, UNARMED_STRIKE, weaponOptionsFor } from '../damage/weaponAttack.js';
import { attackWithReaction } from '../heroicActions/reactions.js';
import { rollUnarmedStrike, strikeUnarmed } from '../heroicActions/unarmedStrike.js';
import localize from '../localize.js';
import { type GrantedAttackKind, grantedAttackKind } from './grantedAttackKind.js';

/** What a granted attack line says about the attack it gives. */
export interface GrantedAttackLine {
	sourceItemUuid: string;
	weaponKind: GrantedWeaponKind;
	allowsCantrips: boolean;
	free: boolean;
	spendsReaction: boolean;
	ignoresRushed: boolean;
}

export interface GrantedAttackChoice {
	/** A weapon or spell uuid, or the Unarmed Strike choice. */
	value: string;
	name: string;
}

/** A group of the dropdown. The label is null for the weapons when they are the only group. */
export interface GrantedAttackGroup {
	label: string | null;
	choices: GrantedAttackChoice[];
}

interface RecipientItem {
	id?: string | null;
	uuid?: string;
	name?: string;
	type?: string;
	system?: unknown;
}

interface Recipient {
	type?: string | null;
	system?: unknown;
	rules?: unknown;
	items?: Iterable<RecipientItem>;
	activateItem?: (id: string, options?: Record<string, unknown>) => Promise<unknown>;
}

const isCantrip = (item: RecipientItem) =>
	item.type === 'spell' && (item.system as { tier?: number } | undefined)?.tier === 0;

/**
 * The dropdown of a line: the fitting weapons as the weapon pick groups them, then the cantrips.
 * With cantrips, every group has its heading.
 */
export function grantedAttackGroups(
	actor: Recipient,
	line: Pick<GrantedAttackLine, 'weaponKind' | 'allowsCantrips'>,
): GrantedAttackGroup[] {
	const cantrips = line.allowsCantrips
		? [...(actor.items ?? [])]
				.filter(isCantrip)
				.map((spell) => ({ value: spell.uuid ?? '', name: spell.name ?? '' }))
		: [];
	const weapons = groupWeapons(weaponOptionsFor(actor as never, line.weaponKind), {
		headed: cantrips.length > 0,
	}).map((group) => ({
		label: group.label,
		choices: group.weapons.map((weapon) => ({ value: weapon.uuid, name: weapon.name })),
	}));
	if (cantrips.length < 1) return weapons;
	return [
		...weapons,
		{ label: localize('NIMBLE.chat.grantedActionOffers.cantrips'), choices: cantrips },
	];
}

/** How many creatures the attack of a line can target: 1, plus the extras the recipient's rules give. */
export interface GrantedAttackTargets {
	count: number;
	extras: ExtraTargets[];
}

/** The targets of a line's attack. More than 1: the extra targets share one attack. */
export function grantedAttackTargets(
	actor: Recipient,
	line: Pick<GrantedAttackLine, 'sourceItemUuid'>,
): GrantedAttackTargets {
	const rules = rulesOfType(actor, 'extraTargets');
	if (rules.length < 1 || !line.sourceItemUuid) return { count: 1, extras: [] };
	const origin = attackOriginOf({}, line.sourceItemUuid).identifier;
	const extras = rules.flatMap((rule) => {
		const extra = rule.extraTargetsFor(origin);
		return extra ? [extra] : [];
	});
	return { count: extras.reduce((total, extra) => total + extra.count, 1), extras };
}

async function attack(
	actor: Recipient,
	line: GrantedAttackLine,
	choice: string,
	kind: GrantedAttackKind,
): Promise<boolean> {
	const free = kind !== 'action';
	const targets = grantedAttackTargets(actor, line).count;
	const options = {
		originUuid: line.sourceItemUuid,
		...(line.ignoresRushed ? { ignoresRushed: true } : {}),
		...(targets > 1 ? { sharedTargets: targets } : {}),
	};
	if (choice === UNARMED_STRIKE) {
		const hero = actor as NimbleCharacter;
		return free
			? rollUnarmedStrike(hero, { ...options, free: true })
			: strikeUnarmed(hero, options);
	}
	const item = [...(actor.items ?? [])].find((each) => each.uuid === choice);
	if (!item?.id || !actor.activateItem) return false;
	const card = await actor.activateItem(item.id, {
		...options,
		...(free ? { skipActionDeduction: true } : {}),
		...(kind === 'free' ? { grantedFree: true } : {}),
	});
	return Boolean(card);
}

/**
 * Makes the attack of a line with the chosen weapon, Unarmed Strike or cantrip, made through the
 * granting feature. A free line spends no action; a line that spends the reaction spends that in
 * place of an action. A free opportunity attack spends neither. True when the attack was made.
 */
export async function makeGrantedAttack(
	actor: Recipient,
	line: GrantedAttackLine,
	choice: string,
): Promise<boolean> {
	const kind = grantedAttackKind(line);
	if (kind === 'reaction') {
		return attackWithReaction(actor as NimbleCharacter, () => attack(actor, line, choice, kind));
	}
	return attack(actor, line, choice, kind);
}
