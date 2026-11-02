import { SYSTEM_ID } from '#system';
import { attackDeliveryFromAttackType } from '#utils/damage/attackDelivery.js';
import localize from '#utils/localize.js';
import { getToggledTargetTags, readToggledEffects } from '../actor/toggledEffects.js';
import { applyRecoveryToActorIfEligible } from './chargePoolRecover.js';
import { getChargeConsumers } from './helpers.js';
import type { CharacterActorLike } from './types.js';

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

/** An Unarmed Strike has no item use, so its hit fires the recoveries here. */
export async function giveUnarmedHitRecovery(
	actor: CharacterActorLike,
	roll: { isMiss?: boolean; isCritical?: boolean },
	targets: readonly TargetToken[],
): Promise<void> {
	if (roll.isMiss) return;
	const use = { domain: recoveryDomainOf(actor, 'reach', targets) };
	await applyRecoveryToActorIfEligible(actor as never, 'onHit', undefined, use);
	if (roll.isCritical) {
		await applyRecoveryToActorIfEligible(actor as never, 'onCriticalHit', undefined, use);
	}
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
		if (hero.isOwner) {
			await applyRecoveryToActorIfEligible(hero as never, 'onMarkedDeath', undefined, {
				spentPoolIds: new Set(spentPoolIds),
			});
			continue;
		}
		const gm = (
			game.users as unknown as {
				activeGM?: { query(name: string, data: object): Promise<unknown> } | null;
			}
		).activeGM;
		if (!gm) {
			ui.notifications?.warn(localize('NIMBLE.chat.cardActionNeedsGm'));
			continue;
		}
		await gm.query(QUERY_NAME, { actorUuid: hero.uuid, spentPoolIds });
	}
}

export function registerMarkedDeathQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: { actorUuid: string; spentPoolIds: string[] }) => {
			const actor = fromUuidSync(data.actorUuid as never) as never;
			await applyRecoveryToActorIfEligible(actor, 'onMarkedDeath', undefined, {
				spentPoolIds: new Set(data.spentPoolIds),
			});
			return true;
		};
	});
}
