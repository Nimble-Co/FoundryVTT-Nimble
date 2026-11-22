import type { HeldChange } from '#types/heldChange.d.ts';
import { cardRicochet } from '#utils/damage/cardRicochet.js';
import { spendHeldChanges } from '#utils/heldChange/heldChange.js';
import type { Ricochet } from '../../models/rules/ricochet.js';
import { clearBankedDamageReduction } from '../../utils/damage/bankedDamageReduction.js';
import { withDamageCard } from '../../utils/damage/damageCard.js';

/** The creature a ricochet goes to, and the damage it took once applied. */
export const RICOCHET_FLAG = 'ricochet';

export interface RicochetRecord {
	targetUuid?: string;
	applied?: boolean;
	/** The damage the creature took. */
	amount?: number;
}

/** One damage packet of the card. */
export interface RicochetPacket {
	value: number;
	options: { damageMultiplier?: number };
}

type RicochetActor = Actor.Implementation & { applyDamage(amount: number): Promise<unknown> };

/** Damage after the defenses of a creature. */
export interface RicochetDamage {
	total: number;
	consumedBank: boolean;
	usedVulnerabilities: HeldChange[];
}

/** What the ricochet of a card reads from the card. */
export interface RicochetCard {
	id(): string | null;
	/** An activation card that did not miss. */
	isHit(): boolean;
	attacker(): { rules?: unknown } | null;
	flags(): Record<string, unknown> | undefined;
	/** The card's damage packets that would remove HP. */
	damagePackets(): RicochetPacket[];
	damageAfterDefenses(actor: RicochetActor, packets: RicochetPacket[]): RicochetDamage;
	endedLines(): Parameters<typeof spendHeldChanges>[1];
	setFlag(key: string, value: RicochetRecord): Promise<unknown>;
}

/** The ricochet of a hit card: half its damage to another creature. */
export class CardRicochet {
	#host: RicochetCard;

	constructor(host: RicochetCard) {
		this.#host = host;
	}

	/** What a hit of this card ricochets with, or null. */
	ricochet(): Ricochet | null {
		if (!this.#host.isHit()) return null;
		return cardRicochet(this.#host.attacker(), this.#host.flags() as never);
	}

	/** The creature this card's ricochet goes to, and whether its damage is applied. */
	get record(): RicochetRecord {
		return (this.#host.flags()?.[RICOCHET_FLAG] as RicochetRecord | undefined) ?? {};
	}

	/** Half of the hit, rounded down, after the defenses of the token's creature. */
	#damageOn(tokenUuid: string): (RicochetDamage & { actor: RicochetActor }) | null {
		const actor = (fromUuidSync(tokenUuid) as TokenDocument | null)?.actor as
			| RicochetActor
			| null
			| undefined;
		if (!actor) return null;
		const packets = this.#host.damagePackets().map(({ value, options }) => ({
			value: Math.floor(value / 2),
			options: { ...options, damageMultiplier: (options.damageMultiplier ?? 1) * 0.5 },
		}));
		return packets.length > 0 ? { ...this.#host.damageAfterDefenses(actor, packets), actor } : null;
	}

	/** What the ricochet deals to the token's creature, or null when nothing can be dealt. */
	damage(tokenUuid: string): number | null {
		if (!this.ricochet()) return null;
		return this.#damageOn(tokenUuid)?.total ?? null;
	}

	/** The creature a player picks for the ricochet, for the GM to apply. */
	async setTarget(tokenUuid: string): Promise<void> {
		if (!this.ricochet() || this.record.applied) return;
		await this.#host.setFlag(RICOCHET_FLAG, { targetUuid: tokenUuid });
	}

	async applyDamage(tokenUuid: string): Promise<void> {
		if (!game.user?.isGM || this.record.applied || !this.ricochet()) return;
		const resolved = this.#damageOn(tokenUuid);
		if (!resolved) return;
		if (resolved.consumedBank) await clearBankedDamageReduction(resolved.actor);
		await withDamageCard(this.#host.id(), () => resolved.actor.applyDamage(resolved.total));
		await spendHeldChanges(resolved.usedVulnerabilities, this.#host.endedLines());
		await this.#host.setFlag(RICOCHET_FLAG, {
			targetUuid: tokenUuid,
			applied: true,
			amount: resolved.total,
		});
	}
}
