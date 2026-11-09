import type {
	ConditionCreature,
	ConditionEffect,
	ConditionRollMode,
} from '#types/conditionRollMode.d.ts';
import type { AttackDelivery } from '../damage/attackDelivery.js';

type AddLine = (
	side: ConditionRollMode['side'],
	condition: string,
	step: number,
	name: string,
	extra?: Partial<ConditionRollMode>,
) => void;

interface ConditionRollInput {
	kind: 'attack' | 'check';
	roller: ConditionCreature | null | undefined;
	/** The attack's only target; null with no target or two or more, or an area. */
	target?: ConditionCreature | null;
	delivery?: AttackDelivery;
}

/**
 * "Attacks against you" (Core:389-421). Grappled stands for Restrained and
 * Incapacitated for its group, as their aliases give those tags (Core:1934, :1970).
 */
function targetSteps(delivery: AttackDelivery | undefined): Array<[string, number]> {
	const prone = delivery === 'melee' ? 1 : delivery === 'ranged' ? -1 : 0;
	return [
		['blinded', 1],
		['grappled', 1],
		['incapacitated', 1],
		['prone', prone],
		['invisible', -1],
	];
}

/** An attack that is neither melee nor ranged: both Prone lines, off, for the table to pick. */
function proneWithNoDelivery(add: AddLine, name: string): void {
	add('target', 'prone', 1, name, { key: 'target:prone:melee', on: false });
	add('target', 'prone', -1, name, { key: 'target:prone:ranged', on: false });
}

/** The roller's own conditions (Core:389-421, GM:1906). Poisoned and Frightened change every roll. */
const SELF_ATTACK_STEPS: Array<[string, number]> = [
	['blinded', -1],
	['prone', -1],
	['invisible', 1],
];
const SELF_ROLL_STEPS: Array<[string, number]> = [
	['poisoned', -1],
	['frightened', -1],
];

/**
 * The uuid of the creature that caused the most recent Taunted, from the
 * effect's origin: an actor, or an item on one. Null when no creature is known.
 */
function taunterUuid(roller: ConditionCreature | null | undefined): string | null {
	let latest: ConditionEffect | null = null;
	for (const effect of roller?.effects ?? []) {
		if (effect.disabled || !effect.statuses?.has('taunted')) continue;
		const time = effect._stats?.createdTime ?? 0;
		if (!latest || time >= (latest._stats?.createdTime ?? 0)) latest = effect;
	}
	const actorUuid = latest?.origin?.split('.Item.')[0] ?? '';
	return /^(Actor|Scene)\./.test(actorUuid) ? actorUuid : null;
}

/** Disadvantage on attacks except against the most recent taunter (Core:409). */
function tauntedLine(
	roller: ConditionCreature | null | undefined,
	target: ConditionCreature | null | undefined,
) {
	const taunter = taunterUuid(roller);
	if (!taunter || !target?.uuid) return { ask: 'taunter' as const };
	return target.uuid === taunter ? null : {};
}

/** The conditions that change the roll mode of this roll, in a fixed order. */
function conditionRollModes(input: ConditionRollInput): ConditionRollMode[] {
	const lines: ConditionRollMode[] = [];
	const target = input.kind === 'attack' ? input.target : null;
	const targetTags = target?.getTargetDomain?.() ?? new Set<string>();
	const add: AddLine = (side, condition, step, name, extra = {}) =>
		lines.push({ key: `${side}:${condition}`, condition, side, step, on: true, name, ...extra });

	const rollerTags = input.roller?.getDomain?.() ?? new Set<string>();
	const rollerName = input.roller?.name ?? '';
	const selfSteps =
		input.kind === 'attack' ? [...SELF_ATTACK_STEPS, ...SELF_ROLL_STEPS] : SELF_ROLL_STEPS;
	for (const [condition, step] of selfSteps) {
		if (!rollerTags.has(`self:${condition}`)) continue;
		add(
			'self',
			condition,
			step,
			rollerName,
			condition === 'frightened' ? { ask: 'fearNearby' } : {},
		);
	}
	if (input.kind === 'attack' && rollerTags.has('self:taunted')) {
		const taunted = tauntedLine(input.roller, input.target);
		if (taunted) add('self', 'taunted', -1, rollerName, taunted);
	}
	if (input.kind === 'attack' && rollerTags.has('self:despair')) {
		add('self', 'despair', -1, rollerName, { ends: true });
	}

	const targetName = target?.name ?? '';
	for (const [condition, step] of targetSteps(input.delivery)) {
		if (!targetTags.has(`target:${condition}`)) continue;
		if (step !== 0) add('target', condition, step, targetName);
		else proneWithNoDelivery(add, targetName);
	}
	return lines;
}

export { conditionRollModes };
