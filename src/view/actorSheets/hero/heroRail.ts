import { getPendingActionsLocalizationKey } from '#utils/combat/pendingActionWording.js';
import type { PoolKind } from '../parts/types.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import { signedNumber } from '../shared/signedNumber.ts';
import type { HeroIntent } from './heroIntent.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

export interface WoundsMeterView {
	kind: 'wounds';
	id: 'wounds';
	label: string;
	value: number;
	max: number;
	/** the last wound: the hero is dead */
	dead: boolean;
	segments: { on: boolean; label: string; intent: HeroIntent }[];
}

export interface HitDiceMeterView {
	kind: 'hitDice';
	id: 'hitDice';
	label: string;
	/** the die sizes, for example `d12 + d6` */
	sizes: string;
	value: number;
	max: number;
	/** one die size: you type the current number; more sizes: the edit window */
	typeable: boolean;
	roll: HeroIntent;
	edit: HeroIntent | null;
}

export interface ManaMeterView {
	kind: 'mana';
	id: 'mana';
	label: string;
	value: number;
	max: number;
	/** you get the mana when you roll Initiative */
	idle: boolean;
}

export interface DicePoolMeterView {
	kind: 'dicePool';
	id: string;
	poolKind: PoolKind;
	label: string;
	icon: string;
	die: number;
	faces: number[];
	max: number;
	/** roll one more die into the pool; null when it is full */
	add: HeroIntent | null;
}

export interface ChargesMeterView {
	kind: 'charges';
	id: string;
	poolKind: PoolKind;
	label: string;
	icon: string;
	/** each charge is a die that you roll when you spend it */
	die: number | null;
	value: number;
	max: number;
	/** the temporary uses in `value` */
	temporary: number;
	/** roll and spend one die; null with no die or no charge */
	rollOne: HeroIntent | null;
}

export type HeroMeterView =
	| WoundsMeterView
	| HitDiceMeterView
	| ManaMeterView
	| DicePoolMeterView
	| ChargesMeterView;

export interface HeroSpeedView {
	type: string;
	label: string;
	icon: string;
	value: number;
	/** the bonus from rules, for example `+2` */
	note: string | null;
	tooltip: string;
}

export interface HeroTurnView {
	isTurn: boolean;
	heading: string;
	current: number;
	max: number;
	cells: { available: boolean; label: string; intent: HeroIntent }[];
	/** null at the most actions a turn can have */
	addAction: HeroIntent | null;
	/** what the next turn gains or loses */
	pending: string | null;
	/** only on your turn; `question` is asked first while actions are left */
	endTurn: { intent: HeroIntent; question: string | null } | null;
	/** off your turn: what a reaction costs */
	hint: string | null;
}

export interface HeroRailView {
	name: string;
	img: string;
	meta: string;
	hp: {
		value: number;
		max: number;
		temp: number;
		/** Bloodied or Dying, in words */
		state: string | null;
		dying: boolean;
		tooltip: string;
	};
	armor: { label: string; value: number; tooltip: string };
	speeds: HeroSpeedView[];
	meters: HeroMeterView[];
	initiative: { label: string; mod: string; rollMode: number; intent: HeroIntent | null };
	/** null in combat */
	rests: { field: HeroIntent; safe: HeroIntent } | null;
	/** null out of combat, and before you roll Initiative */
	turn: HeroTurnView | null;
	levelUp: { intent: HeroIntent | null; tooltip: string };
	revertLevelUp: HeroIntent | null;
	levelCorrection: { label: string; tooltip: string; intent: HeroIntent } | null;
}

const RAIL = 'NIMBLE.actorSheet.hero.rail';
const MAX_LEVEL = 20;
/** the most actions a turn can have, as the old action tracker */
const MAX_ACTIONS = 10;
const MOVEMENT_ORDER = ['walk', 'fly', 'climb', 'swim', 'burrow'];
const MOVEMENT_ICONS: Record<string, string> = {
	walk: 'fa-solid fa-person-walking',
	fly: 'fa-solid fa-feather',
	climb: 'fa-solid fa-mountain',
	swim: 'fa-solid fa-water',
	burrow: 'fa-solid fa-circle-down',
};
const DIE_SIZES = [4, 6, 8, 10, 12, 20];

const dieNumber = (dieSize: string | null) => (dieSize ? Number(dieSize.replace(/^d/, '')) : null);
const firstOfType = (actor: HeroActorLike, type: string): ItemLike | undefined =>
	actor.items.find((item) => item.type === type);

function incrementDieSize(size: number, steps: number): number {
	const index = DIE_SIZES.indexOf(size);
	if (index === -1) return size;
	return DIE_SIZES[Math.min(index + steps, DIE_SIZES.length - 1)];
}

function meta(actor: HeroActorLike, context: HeroSheetContext): string {
	const { format, localize } = context;
	const ancestry = firstOfType(actor, 'ancestry');
	const characterClass = firstOfType(actor, 'class');
	const subclass = firstOfType(actor, 'subclass');
	const parts: string[] = [];
	if (ancestry) {
		parts.push(
			format(`${RAIL}.metaAncestry`, {
				ancestry: ancestry.name,
				size: localize(`NIMBLE.sizeCategories.${actor.system.attributes.sizeCategory}`),
			}),
		);
	}
	if (characterClass) {
		const level = String(characterClass.system.classLevel ?? 1);
		parts.push(
			subclass
				? format(`${RAIL}.metaSubclass`, {
						class: characterClass.name,
						subclass: subclass.name,
						level,
					})
				: format(`${RAIL}.metaClass`, { class: characterClass.name, level }),
		);
	}
	return parts.join(' | ');
}

/** The current and total Hit Dice of each die size, as the old sheet sums them. */
function hitDiceBySize(actor: HeroActorLike): Map<number, { current: number; total: number }> {
	const { hitDice, bonusHitDice, hitDiceSizeBonus } = actor.system.attributes;
	const current = (size: number) => hitDice[size]?.current ?? 0;
	const bySize = new Map<number, { current: number; total: number }>();
	const entry = (size: number) => {
		if (!bySize.has(size)) bySize.set(size, { current: 0, total: 0 });
		return bySize.get(size)!;
	};

	const classSizes = actor.items
		.filter((item) => item.type === 'class')
		.map((item) => {
			const size = incrementDieSize(Number(item.system.hitDieSize), hitDiceSizeBonus);
			const sized = entry(size);
			sized.total += Number(item.system.classLevel ?? 0);
			sized.current = current(size);
			return size;
		});
	const bonusSizes = bonusHitDice.map((bonus) => {
		const size = incrementDieSize(bonus.size, hitDiceSizeBonus);
		const sized = entry(size);
		sized.total += bonus.value;
		if (!classSizes.includes(size)) sized.current = current(size);
		return size;
	});
	for (const [key, data] of Object.entries(hitDice)) {
		if (!data.bonus) continue;
		const size = incrementDieSize(Number(key), hitDiceSizeBonus);
		const sized = entry(size);
		sized.total += data.bonus;
		if (!classSizes.includes(size) && !bonusSizes.includes(size)) sized.current = current(size);
	}
	for (const data of bySize.values()) {
		data.total = Math.max(data.total, 0);
		data.current = Math.min(Math.max(data.current, 0), data.total);
	}
	return bySize;
}

function hitDiceMeter(actor: HeroActorLike, context: HeroSheetContext): HitDiceMeterView {
	const bySize = [...hitDiceBySize(actor).entries()].sort(([a], [b]) => b - a);
	return {
		kind: 'hitDice',
		id: 'hitDice',
		label: context.localize('NIMBLE.hitDice.heading'),
		sizes: bySize.map(([size]) => `d${size}`).join(' + '),
		value: bySize.reduce((sum, [, data]) => sum + data.current, 0),
		max: bySize.reduce((sum, [, data]) => sum + data.total, 0),
		typeable: bySize.length <= 1,
		roll: { kind: 'rollHitDice' },
		edit: bySize.length > 1 ? { kind: 'editHitDice' } : null,
	};
}

function woundsMeter(actor: HeroActorLike, context: HeroSheetContext): WoundsMeterView | null {
	const { value, max } = actor.system.attributes.wounds;
	if (max <= 0) return null;
	return {
		kind: 'wounds',
		id: 'wounds',
		label: context.localize('NIMBLE.wounds.heading'),
		value,
		max,
		dead: value >= max,
		segments: Array.from({ length: max }, (_, index) => {
			const level = index + 1;
			return {
				on: level <= value,
				label: context.format(`${RAIL}.toggleWound`, { number: String(level) }),
				intent: { kind: 'setWounds', value: level <= value ? level - 1 : level },
			};
		}),
	};
}

function manaMeter(actor: HeroActorLike, context: HeroSheetContext): ManaMeterView | null {
	const { mana } = actor.system.resources;
	const classFormula = actor.items.some((item) => {
		const formula = (item.system.mana as { formula?: string } | undefined)?.formula;
		return item.type === 'class' && !!formula?.length;
	});
	const hasMana = context.manaFromInitiative || mana.max > 0 || mana.baseMax > 0 || classFormula;
	if (!hasMana) return null;
	const idle = context.manaFromInitiative && !context.combat?.initiativeRolled;
	return {
		kind: 'mana',
		id: 'mana',
		label: context.localize('NIMBLE.ui.combatTracker.mana'),
		value: idle ? 0 : mana.current,
		max: mana.max || mana.baseMax,
		idle,
	};
}

function poolMeters(context: HeroSheetContext): HeroMeterView[] {
	const dice: HeroMeterView[] = context.dicePools
		.filter((pool) => pool.max > 0)
		.map((pool) => ({
			kind: 'dicePool',
			id: pool.id,
			poolKind: 'dice',
			label: pool.label,
			icon: pool.icon || 'fa-solid fa-dice',
			die: dieNumber(pool.dieSize) ?? 6,
			faces: [...pool.faces],
			max: pool.max,
			add:
				pool.faces.length < pool.max
					? { kind: 'rollIntoDicePool', poolId: pool.id, label: pool.label }
					: null,
		}));
	const charges: HeroMeterView[] = context.chargePools
		.filter((pool) => !pool.hidden && (pool.showAsResource || pool.dieSize !== null))
		.map((pool) => {
			const die = dieNumber(pool.dieSize);
			return {
				kind: 'charges',
				id: pool.id,
				poolKind: die ? 'charges' : 'uses',
				label: pool.label,
				icon: pool.icon || (die ? 'fa-solid fa-dice-d20' : 'fa-solid fa-circle-dot'),
				die,
				value: pool.current,
				max: pool.max,
				temporary: pool.temporary ?? 0,
				rollOne:
					die && pool.current > 0
						? { kind: 'rollPoolCharge', poolId: pool.id, label: pool.label }
						: null,
			};
		});
	return [...dice, ...charges];
}

function speeds(actor: HeroActorLike, context: HeroSheetContext): HeroSpeedView[] {
	const { movement } = actor.system.attributes;
	const bonusFor = (type: string) =>
		actor.items.flatMap((item) =>
			item.rules
				.filter((rule) => rule.type === 'speedBonus' && rule.active && rule.amount)
				.filter((rule) => ((rule.fields.movementType as string | null) ?? 'walk') === type)
				.map((rule) => ({ amount: rule.amount ?? 0, source: item.name })),
		);
	return MOVEMENT_ORDER.filter((type) => type === 'walk' || (movement[type] ?? 0) > 0).map(
		(type) => {
			const bonuses = bonusFor(type);
			const total = bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
			const label = context.localize(`NIMBLE.movementTypes.${type}`);
			const value = movement[type] ?? 0;
			return {
				type,
				label: context.localize(`${RAIL}.speed.${type}`),
				icon: MOVEMENT_ICONS[type],
				value,
				note: total ? signedNumber(total) : null,
				tooltip: [
					context.format(`${RAIL}.speedTooltip`, { type: label, value: String(value) }),
					...bonuses.map((bonus) =>
						context.format('NIMBLE.actorSheet.hero.core.speedBonus', {
							amount: signedNumber(bonus.amount),
							source: bonus.source,
						}),
					),
				].join('. '),
			};
		},
	);
}

function turn(context: HeroSheetContext): HeroTurnView | null {
	const { combat, localize, format } = context;
	if (!combat?.initiativeRolled) return null;
	const { current, effectiveMax, pendingDelta } = combat.actions;
	const count = Math.max(effectiveMax, current);
	return {
		isTurn: combat.isTurn,
		heading: localize(`${RAIL}.${combat.isTurn ? 'yourTurn' : 'notYourTurn'}`),
		current,
		max: effectiveMax,
		cells: Array.from({ length: count }, (_, index) => {
			const available = index < current;
			return {
				available,
				label: format(`NIMBLE.ui.heroicActions.pip.${available ? 'spend' : 'restore'}Action`, {
					number: String(index + 1),
				}),
				intent: {
					kind: 'setActions',
					value: available ? Math.max(current - 1, 0) : Math.min(current + 1, effectiveMax),
				},
			};
		}),
		addAction: effectiveMax < MAX_ACTIONS ? { kind: 'addAction' } : null,
		pending: pendingDelta
			? format(getPendingActionsLocalizationKey(pendingDelta), {
					count: String(Math.abs(pendingDelta)),
				})
			: null,
		endTurn: combat.isTurn
			? {
					intent: { kind: 'endTurn' },
					question: current > 0 ? localize(`${RAIL}.endTurnQuestion`) : null,
				}
			: null,
		hint: combat.isTurn ? null : localize(`${RAIL}.offTurnHint`),
	};
}

function levelUp(actor: HeroActorLike, context: HeroSheetContext): HeroRailView['levelUp'] {
	const characterClass = firstOfType(actor, 'class');
	if (!characterClass) return { intent: null, tooltip: context.localize(`${RAIL}.levelUpNoClass`) };
	if (Number(characterClass.system.classLevel ?? 1) >= MAX_LEVEL) {
		return { intent: null, tooltip: context.localize(`${RAIL}.levelUpMax`) };
	}
	return { intent: { kind: 'levelUp' }, tooltip: context.localize(`${RAIL}.levelUpHint`) };
}

/** The rail of the character sheet (the header of the narrow form): who, vitals, turn, meters. */
export function heroRail(actor: HeroActorLike, context: HeroSheetContext): HeroRailView {
	const { localize, format } = context;
	const { hp, armor, initiative } = actor.system.attributes;
	const dying = hp.value <= 0;
	const bloodied = !dying && hp.value <= hp.max / 2;
	const state = dying ? 'dying' : bloodied ? 'bloodied' : null;
	const missing = context.missingLevelSelections;

	return {
		name: actor.name,
		img: actor.img,
		meta: meta(actor, context),
		hp: {
			value: hp.value,
			max: hp.max,
			temp: hp.temp,
			state: state ? localize(`NIMBLE.conditions.${state}`) : null,
			dying,
			tooltip: localize(`${RAIL}.hp.${state ?? 'healthy'}`),
		},
		armor: {
			label: localize(`${RAIL}.armor`),
			value: armor.value,
			tooltip: format(`${RAIL}.armorTooltip`, { value: String(armor.value) }),
		},
		speeds: speeds(actor, context),
		meters: [
			woundsMeter(actor, context),
			manaMeter(actor, context),
			...poolMeters(context),
			hitDiceMeter(actor, context),
		].filter((meter): meter is HeroMeterView => meter !== null),
		initiative: {
			label: localize('NIMBLE.prompts.rollInitiative'),
			mod: signedNumber(initiative.mod),
			rollMode: initiative.defaultRollMode,
			intent: context.combat?.initiativePending ? null : { kind: 'rollInitiative' },
		},
		rests: context.combat
			? null
			: { field: { kind: 'rest', restType: 'field' }, safe: { kind: 'rest', restType: 'safe' } },
		turn: turn(context),
		levelUp: levelUp(actor, context),
		revertLevelUp: actor.system.levelUpHistory.length ? { kind: 'revertLevelUp' } : null,
		levelCorrection: missing.length
			? {
					label: localize('NIMBLE.levelCorrectionDialog.sheetWarning'),
					tooltip: format('NIMBLE.levelCorrectionDialog.sheetWarningTooltip', {
						level: String(missing[0]),
					}),
					intent: { kind: 'correctLevels' },
				}
			: null,
	};
}
