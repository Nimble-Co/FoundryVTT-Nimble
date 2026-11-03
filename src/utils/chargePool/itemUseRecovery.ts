import { SYSTEM_ID } from '#system';
import { askActiveGm } from '#utils/askActiveGm.js';
import { attackDeliveryFromAttackType } from '#utils/damage/attackDelivery.js';
import { getToggledTargetTags, readToggledEffects } from '../actor/toggledEffects.js';
import { applyRecoveryToActorIfEligible } from './chargePoolRecover.js';
import { RECOVERY_DOMAIN_FLAG, RECOVERY_GIVEN_FLAG } from './chargePoolReroll.js';
import { getChargeConsumers } from './helpers.js';
import type { CharacterActorLike, ChargeRecoveryGiven } from './types.js';

const QUERY_NAME = `${SYSTEM_ID}.markedDeath`;

interface UsedItem {
	actor?: unknown;
	rules?: unknown;
	system?: { activation?: { targets?: { attackType?: string } } };
}

interface TargetToken {
	actor?: { uuid?: string } | null;
}

/** What a recovery predicate reads of an attack: the first target and how it attacked. */
export function recoveryDomainOf(
	attacker: unknown,
	attackType: string | undefined,
	targets: readonly TargetToken[] | undefined,
): string[] {
	const tags = [...getToggledTargetTags(attacker as never, targets?.[0]?.actor)];
	const delivery = attackDeliveryFromAttackType(attackType);
	return delivery ? [...tags, `attack:${delivery}`] : tags;
}

export function itemUseRecoveryDomain(
	item: UsedItem,
	targets: readonly TargetToken[] | undefined,
): string[] {
	return recoveryDomainOf(item.actor, item.system?.activation?.targets?.attackType, targets);
}

/** The pools a use of this item spends from. */
export function spentPoolIdsOf(item: unknown): Set<string> {
	const used = item as UsedItem | null;
	if (!used?.actor) return new Set();
	return new Set(
		getChargeConsumers(used.actor as CharacterActorLike, used as never).map(
			(consumer) => consumer.poolId,
		),
	);
}

/**
 * An Unarmed Strike has no item use, so its hit fires the recoveries here. The
 * flags go on its card, so that a reroll can follow them.
 */
export async function giveUnarmedHitRecovery(
	actor: CharacterActorLike,
	roll: { isMiss?: boolean; isCritical?: boolean },
	targets: readonly TargetToken[],
): Promise<Record<string, unknown>> {
	const domain = recoveryDomainOf(actor, 'reach', targets);
	const given: ChargeRecoveryGiven = [];
	if (!roll.isMiss) {
		const use = { domain };
		await applyRecoveryToActorIfEligible(actor as never, 'onHit', undefined, use, given);
		if (roll.isCritical) {
			await applyRecoveryToActorIfEligible(actor as never, 'onCriticalHit', undefined, use, given);
		}
	}
	return {
		[`flags.${SYSTEM_ID}.${RECOVERY_GIVEN_FLAG}`]: given,
		[`flags.${SYSTEM_ID}.${RECOVERY_DOMAIN_FLAG}`]: domain,
	};
}

interface HeroActor {
	uuid?: string;
	type?: string;
	isOwner?: boolean;
	getFlag?(scope: string, key: string): unknown;
}

function heroesWhoMarked(creatureUuid: string | undefined): HeroActor[] {
	if (!creatureUuid) return [];
	const actors = [...(game.actors ?? [])] as unknown as HeroActor[];
	return actors.filter(
		(actor) =>
			actor.type === 'character' &&
			Object.values(readToggledEffects(actor as never)).some(
				(entries) =>
					Array.isArray(entries) && entries.some((entry) => entry.actorUuid === creatureUuid),
			),
	);
}

/** Each hero who marked the creature gains, also from an attack of an ally. */
export async function giveMarkedDeathRecovery(
	creature: { uuid?: string },
	sourceItem: unknown,
): Promise<void> {
	const spent = spentPoolIdsOf(sourceItem);
	const source = (sourceItem as UsedItem | null)?.actor;
	for (const hero of heroesWhoMarked(creature.uuid)) {
		const spentPoolIds = hero === source ? [...spent] : [];
		const domain = [...getToggledTargetTags(hero as never, creature)];
		if (hero.isOwner) {
			await applyRecoveryToActorIfEligible(hero as never, 'onMarkedDeath', undefined, {
				domain,
				spentPoolIds: new Set(spentPoolIds),
			});
			continue;
		}
		await askActiveGm(QUERY_NAME, { actorUuid: hero.uuid, domain, spentPoolIds });
	}
}

export function registerMarkedDeathQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: {
			actorUuid: string;
			domain: string[];
			spentPoolIds: string[];
		}) => {
			const actor = fromUuidSync(data.actorUuid as never) as never;
			await applyRecoveryToActorIfEligible(actor, 'onMarkedDeath', undefined, {
				domain: data.domain,
				spentPoolIds: new Set(data.spentPoolIds),
			});
			return true;
		};
	});
}
