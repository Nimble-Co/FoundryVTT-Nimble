import { MOVEMENT_ORDER } from '../shared/movement.ts';
import type { HeroActorLike } from './heroSource.ts';

export interface SpeedBonus {
	type: string;
	amount: number;
	source: string;
}

/** Walking always, then each other movement type that the hero has. */
export function shownMovementTypes(actor: HeroActorLike): string[] {
	const { movement } = actor.system.attributes;
	return MOVEMENT_ORDER.filter((type) => type === 'walk' || (movement[type] ?? 0) > 0);
}

export function speedBonuses(actor: HeroActorLike): SpeedBonus[] {
	return actor.items.flatMap((item) =>
		item.rules
			.filter((rule) => rule.type === 'speedBonus' && rule.active && rule.amount)
			.map((rule) => ({
				type: (rule.fields.movementType as string | null) ?? 'walk',
				amount: rule.amount ?? 0,
				source: item.name,
			})),
	);
}
