import { SYSTEM_ID } from '#system';
import type { HeldChangeEnd } from '#types/heldChange.d.ts';
import { heldChangeMoments } from '#utils/heldChange/heldChange.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

/** The flag a Held Change had before it was a Held Roll rule. */
interface OldHeldChange {
	kind?: string;
	value?: number;
	label?: string;
	appliesTo?: 'holderAttacks' | 'attacksOnHolder';
	spentBy?: 'oneRoll' | 'everyRoll';
	ends?: HeldChangeEnd;
	combatId?: string;
	round?: number;
	turn?: number;
	damageType?: string;
	sourceMessageId?: string;
}

interface HeldEffect {
	id: string | null;
	name?: string | null;
	flags?: Record<string, Record<string, unknown> | undefined>;
	system?: { rules?: unknown[] };
}

interface CombatLike {
	started?: boolean;
	round?: number | null;
	turn?: number | null;
}

const OLD_FLAG = 'heldChange';

function oldHeldChangeOf(effect: Pick<HeldEffect, 'flags'>): OldHeldChange | null {
	const flag = effect.flags?.[SYSTEM_ID]?.[OLD_FLAG];
	return flag && typeof flag === 'object' ? (flag as OldHeldChange) : null;
}

/** The old change no longer held: its combat, round or turn is over. */
export function oldHeldChangeEnded(
	change: OldHeldChange,
	combatOf: (id: string) => CombatLike | null | undefined,
): boolean {
	const combat = change.combatId ? combatOf(change.combatId) : null;
	if (!combat?.started) return true;
	const ends = change.ends ?? 'turn';
	if (ends === 'combat') return false;
	if ((combat.round ?? 0) !== (change.round ?? 0)) return true;
	return ends === 'turn' && (combat.turn ?? 0) !== (change.turn ?? 0);
}

/** The update that turns the old flag into a Held Roll rule and its Lasts Until. */
export function heldChangeUpdate(
	effect: HeldEffect,
	change: OldHeldChange,
): Record<string, unknown> {
	const rule = {
		id: foundry.utils.randomID(),
		type: 'heldRoll',
		label: change.label ?? effect.name ?? '',
		heldKind: change.kind ?? 'primaryDie',
		value: Number(change.value ?? 0),
		whichRoll: change.appliesTo ?? 'holderAttacks',
		usedUp: change.spentBy !== 'everyRoll',
		...(change.damageType ? { damageType: change.damageType } : {}),
	};
	return {
		_id: effect.id,
		'system.rules': [...(effect.system?.rules ?? []), rule],
		'system.lastsUntil': heldChangeMoments(change.ends ?? 'turn'),
		[`flags.${SYSTEM_ID}.${OLD_FLAG}`]: new foundry.data.operators.ForcedDeletion(),
		...(change.sourceMessageId
			? { [`flags.${SYSTEM_ID}.heldChangeMessage`]: change.sourceMessageId }
			: {}),
	};
}

/** Writes the update of `heldChangeUpdate` into the effect's source. */
function applyHeldChange(source: Omit<HeldEffect, 'id'>, change: OldHeldChange): void {
	const update = heldChangeUpdate({ ...source, id: null }, change);
	for (const [path, value] of Object.entries(update)) {
		if (path !== '_id') foundry.utils.setProperty(source, path, value);
	}
}

/**
 * A Held Change was an effect with a flag, and a hook removed it when its turn, round or combat
 * ended. It becomes a Held Roll rule on the effect, and its time a Lasts Until. A change whose time
 * is already over goes.
 */
class Migration087HeldChangeEffects extends MigrationBase {
	static override readonly version = 87;

	override readonly version = Migration087HeldChangeEffects.version;

	override readonly title = 'Held changes become Held Roll rules';

	override readonly kind: MigrationKind = 'structure';

	override async updateActor(source: any): Promise<void> {
		if (!Array.isArray(source?.effects)) return;
		source.effects = source.effects.filter((effect: Omit<HeldEffect, 'id'>) => {
			const change = oldHeldChangeOf(effect);
			if (!change) return true;
			if (oldHeldChangeEnded(change, (id) => game.combats?.get(id) as CombatLike | undefined)) {
				return false;
			}
			applyHeldChange(effect, change);
			return true;
		});
	}
}

export { Migration087HeldChangeEffects };
