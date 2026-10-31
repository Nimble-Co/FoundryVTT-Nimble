import { incrementDieSize } from '#managers/HitDiceManager.js';
import { getPendingActionsLocalizationKey } from '#utils/combat/pendingActionWording.js';
import type { PoolKind } from '../parts/types.ts';
import { MOVEMENT_ICONS } from '../shared/movement.ts';
import { portraitOf } from '../shared/portrait.ts';
import { type RollModeView, rollModeView } from '../shared/rollModeView.ts';
import type { ItemLike } from '../shared/sheetSource.ts';
import { signedNumber } from '../shared/signedNumber.ts';
import type { HeroIntent } from './heroIntent.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';
import { shownMovementTypes, speedBonuses } from './heroSpeed.ts';

export interface WoundsMeterView {
	kind: 'wounds';
	id: 'wounds';
	label: string;
	value: number;
	max: number;
	/** the last wound: the hero is dead */
	dead: boolean;
	/** `value/max`, or the dead word */
	summary: string;
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
	summary: string;
	currentLabel: string;
	roll: { intent: HeroIntent; label: string; hint: string };
	edit: { intent: HeroIntent; label: string } | null;
	configureLabel: string;
}

export interface ManaMeterView {
	kind: 'mana';
	id: 'mana';
	label: string;
	value: number;
	max: number;
	/** you get the mana when you roll Initiative */
	idle: { note: string; hint: string } | null;
	/** empty while idle */
	summary: string;
	currentLabel: string;
	configureLabel: string;
}

export interface DicePoolMeterView {
	kind: 'dicePool';
	id: string;
	poolKind: PoolKind;
	label: string;
	icon: string;
	die: number;
	faces: number[];
	/** one label for each face */
	faceLabels: string[];
	max: number;
	/** the faces, or `0/max` when the pool is empty */
	summary: string;
	/** roll one more die into the pool; null when it is full */
	add: { intent: HeroIntent; label: string; hint: string } | null;
	text: {
		menu: string;
		setValue: string;
		discard: string;
		discardAll: string;
		discardAllQuestion: string;
	};
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
	/** the temporary uses in `value`, in words; null with none */
	temporary: string | null;
	summary: string;
	currentLabel: string;
	/** roll and spend one die; null with no die or no charge */
	rollOne: { intent: HeroIntent; label: string } | null;
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
	label: string;
	heading: string;
	current: number;
	max: number;
	cells: { available: boolean; label: string; intent: HeroIntent }[];
	/** null at the most actions a turn can have */
	addAction: { intent: HeroIntent; label: string } | null;
	/** what the next turn gains or loses */
	pending: string | null;
	/** only on your turn; `question` is asked first while actions are left */
	endTurn: {
		intent: HeroIntent;
		label: string;
		question: string | null;
		cancelLabel: string;
	} | null;
	/** off your turn: what a reaction costs */
	hint: string | null;
}

export interface HeroRailView {
	text: {
		/** the label of the rail and the narrow header */
		label: string;
		changePortrait: string;
		name: string;
		metaShort: string;
		metaLabel: string;
		hp: string;
		tempHp: string;
		hpShort: string;
		configureHp: string;
		movementShort: string;
		configureMovement: string;
	};
	name: string;
	img: string;
	/** offset in px and scale in percent, from the image settings */
	portrait: { x: number; y: number; scale: number };
	meta: string;
	/** the size of the hero, on the meta line as a tooltip */
	metaHint: string;
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
	/** the seal on the portrait: a click gives or ends it */
	inspiration: { on: boolean; label: string; tooltip: string; intent: HeroIntent };
	speeds: HeroSpeedView[];
	meters: HeroMeterView[];
	initiative: {
		label: string;
		mod: string;
		rollMode: RollModeView | null;
		intent: HeroIntent | null;
	};
	/** null in combat */
	rests: HeroRest[] | null;
	/** null out of combat, and before you roll Initiative */
	turn: HeroTurnView | null;
	levelUp: { label: string; intent: HeroIntent | null; tooltip: string };
	revertLevelUp: HeroAction | null;
	levelCorrection: { label: string; tooltip: string; intent: HeroIntent } | null;
	/** the Edit switch: its words, and the hint for each state */
	edit: { label: string; startHint: string; stopHint: string };
}

export interface HeroAction {
	label: string;
	intent: HeroIntent;
}

export interface HeroRest extends HeroAction {
	icon: string;
}

const RAIL = 'NIMBLE.actorSheet.hero.rail';
const METER = 'NIMBLE.actorSheet.hero.meter';
const TURN = 'NIMBLE.actorSheet.hero.turn';
const MAX_LEVEL = 20;
const dieNumber = (dieSize: string | null) => (dieSize ? Number(dieSize.replace(/^d/, '')) : null);
const firstOfType = (actor: HeroActorLike, type: string): ItemLike | undefined =>
	actor.items.find((item) => item.type === type);

/** "Lv 6 Dwarf Berserker - Red Mist", as the design shows it. */
function meta(actor: HeroActorLike, context: HeroSheetContext): string {
	const { format } = context;
	const ancestry = firstOfType(actor, 'ancestry');
	const characterClass = firstOfType(actor, 'class');
	const subclass = firstOfType(actor, 'subclass');
	const line = [
		characterClass
			? format(`${RAIL}.metaLevel`, { level: String(characterClass.system.classLevel ?? 1) })
			: '',
		ancestry?.name ?? '',
		characterClass?.name ?? '',
	]
		.filter(Boolean)
		.join(' ');
	return subclass && characterClass
		? format(`${RAIL}.metaSubclass`, { line, subclass: subclass.name })
		: line;
}

/** The current and total Hit Dice of each die size: class dice, bonus dice and the size bonus. */
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
	const { localize } = context;
	const value = bySize.reduce((sum, [, data]) => sum + data.current, 0);
	const max = bySize.reduce((sum, [, data]) => sum + data.total, 0);
	return {
		kind: 'hitDice',
		id: 'hitDice',
		label: localize('NIMBLE.hitDice.heading'),
		sizes: bySize.map(([size]) => `d${size}`).join(' + '),
		value,
		max,
		typeable: bySize.length <= 1,
		summary: `${value}/${max}`,
		currentLabel: localize('NIMBLE.hitDice.currentHitDice'),
		roll: {
			intent: { kind: 'rollHitDice' },
			label: localize(`${METER}.roll`),
			hint: localize(`${METER}.rollHitDiceHint`),
		},
		edit:
			bySize.length > 1
				? { intent: { kind: 'editHitDice' }, label: localize('NIMBLE.hitDice.editCurrentHitDice') }
				: null,
		configureLabel: localize('NIMBLE.hitDice.configureHitDice'),
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
		summary: value >= max ? context.localize('NIMBLE.conditions.dead') : `${value}/${max}`,
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
	const { localize, format } = context;
	const idle = context.manaFromInitiative && !context.combat?.initiativeRolled;
	const label = localize('NIMBLE.ui.combatTracker.mana');
	const value = idle ? 0 : mana.current;
	const max = mana.max || mana.baseMax;
	return {
		kind: 'mana',
		id: 'mana',
		label,
		value,
		max,
		idle: idle
			? { note: localize(`${METER}.fromInitiative`), hint: localize(`${METER}.idleHint`) }
			: null,
		summary: idle ? '' : `${value}/${max}`,
		currentLabel: format('NIMBLE.actorSheet.parts.vitalPlate.current', { label }),
		configureLabel: localize('NIMBLE.manaConfig.configureMana'),
	};
}

function poolMeters(context: HeroSheetContext): HeroMeterView[] {
	const { localize, format } = context;
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
			faceLabels: pool.faces.map((face, index) =>
				format(`${METER}.dieLabel`, {
					label: pool.label,
					number: String(index + 1),
					face: String(face),
				}),
			),
			max: pool.max,
			summary: pool.faces.length ? pool.faces.join(' ') : `0/${pool.max}`,
			add:
				pool.faces.length < pool.max
					? {
							intent: { kind: 'rollIntoDicePool', poolId: pool.id, label: pool.label },
							label: format('NIMBLE.actorSheet.parts.dicePool.addLabel', { label: pool.label }),
							hint: localize('NIMBLE.actorSheet.parts.dicePool.add'),
						}
					: null,
			text: {
				menu: localize(`${METER}.dieMenu`),
				setValue: localize(`${METER}.setValue`),
				discard: localize(`${METER}.discard`),
				discardAll: localize(`${METER}.discardAll`),
				discardAllQuestion: format(`${METER}.discardAllQuestion`, { label: pool.label }),
			},
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
				temporary: pool.temporary
					? format(`${METER}.temporary`, { count: String(pool.temporary) })
					: null,
				summary: `${pool.current}/${pool.max}`,
				currentLabel: format('NIMBLE.actorSheet.parts.vitalPlate.current', { label: pool.label }),
				rollOne:
					die && pool.current > 0
						? {
								intent: { kind: 'rollPoolCharge', poolId: pool.id, label: pool.label },
								label: format(`${METER}.rollOne`, { label: pool.label }),
							}
						: null,
			};
		});
	return [...dice, ...charges];
}

function speeds(actor: HeroActorLike, context: HeroSheetContext): HeroSpeedView[] {
	const { movement } = actor.system.attributes;
	const allBonuses = speedBonuses(actor);
	return shownMovementTypes(actor).map((type) => {
		const bonuses = allBonuses.filter((bonus) => bonus.type === type);
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
	});
}

function turn(context: HeroSheetContext): HeroTurnView | null {
	const { combat, localize, format } = context;
	if (!combat?.initiativeRolled) return null;
	const { current, effectiveMax, pendingDelta } = combat.actions;
	const count = Math.max(effectiveMax, current);
	const endTurnLabel = localize('NIMBLE.ui.heroicActions.endTurn');
	return {
		isTurn: combat.isTurn,
		label: localize(`${TURN}.label`),
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
		addAction: combat.actions.mayAdd
			? {
					intent: { kind: 'addAction' },
					label: localize('NIMBLE.ui.heroicActions.addAdditionalAction'),
				}
			: null,
		pending: pendingDelta
			? format(getPendingActionsLocalizationKey(pendingDelta), {
					count: String(Math.abs(pendingDelta)),
				})
			: null,
		endTurn: combat.isTurn
			? {
					intent: { kind: 'endTurn' },
					label: endTurnLabel,
					question: current > 0 ? localize(`${RAIL}.endTurnQuestion`) : null,
					cancelLabel: localize(`${TURN}.keepPlaying`),
				}
			: null,
		hint: combat.isTurn ? null : localize(`${RAIL}.offTurnHint`),
	};
}

function levelUp(actor: HeroActorLike, context: HeroSheetContext): HeroRailView['levelUp'] {
	const label = context.localize('NIMBLE.prompts.levelUp');
	const characterClass = firstOfType(actor, 'class');
	if (!characterClass) {
		return { label, intent: null, tooltip: context.localize(`${RAIL}.levelUpNoClass`) };
	}
	if (Number(characterClass.system.classLevel ?? 1) >= MAX_LEVEL) {
		return { label, intent: null, tooltip: context.localize(`${RAIL}.levelUpMax`) };
	}
	return {
		label,
		intent: { kind: 'levelUp' },
		tooltip: context.localize(`${RAIL}.levelUpHint`),
	};
}

/** The rail of the character sheet (the header of the narrow form): who, vitals, turn, meters. */
export function heroRail(actor: HeroActorLike, context: HeroSheetContext): HeroRailView {
	const { localize, format } = context;
	const { hp, armor, initiative } = actor.system.attributes;
	const dying = hp.value <= 0;
	const bloodied = !dying && hp.value <= hp.max / 2;
	const state = dying ? 'dying' : bloodied ? 'bloodied' : null;
	const missing = context.missingLevelSelections;
	const inspired = actor.system.resources.inspiration;

	return {
		text: {
			label: localize(`${RAIL}.label`),
			changePortrait: localize('NIMBLE.prompts.changeActorImage'),
			name: localize(`${RAIL}.name`),
			metaShort: localize(`${RAIL}.metaShort`),
			metaLabel: localize(`${RAIL}.metaLabel`),
			hp: localize('NIMBLE.actorSheet.parts.vitalPlate.hp'),
			tempHp: localize('NIMBLE.actorSheet.parts.vitalPlate.tempHp'),
			hpShort: localize(`${RAIL}.hpShort`),
			configureHp: localize(`${RAIL}.configureHp`),
			movementShort: localize(`${RAIL}.movementShort`),
			configureMovement: localize('NIMBLE.prompts.configureMovement'),
		},
		name: actor.name,
		img: actor.img,
		portrait: portraitOf(actor.flags),
		meta: meta(actor, context),
		metaHint: context.format(`${RAIL}.metaSize`, {
			size: context.localize(`NIMBLE.sizeCategories.${actor.system.attributes.sizeCategory}`),
		}),
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
		inspiration: {
			on: inspired,
			label: localize(`${RAIL}.inspiration.label`),
			tooltip: localize(`${RAIL}.inspiration.${inspired ? 'on' : 'off'}`),
			intent: { kind: 'setInspiration', value: !inspired },
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
			rollMode: rollModeView(initiative.defaultRollMode, format),
			intent: context.combat?.initiativePending ? null : { kind: 'rollInitiative' },
		},
		rests: context.combat
			? null
			: [
					{
						label: localize('NIMBLE.prompts.fieldRest'),
						icon: 'fa-regular fa-hourglass-half',
						intent: { kind: 'rest', restType: 'field' },
					},
					{
						label: localize('NIMBLE.prompts.safeRest'),
						icon: 'fa-solid fa-moon',
						intent: { kind: 'rest', restType: 'safe' },
					},
				],
		turn: turn(context),
		levelUp: levelUp(actor, context),
		revertLevelUp: actor.system.levelUpHistory.length
			? { label: localize(`${RAIL}.revertLevelUp`), intent: { kind: 'revertLevelUp' } }
			: null,
		levelCorrection: missing.length
			? {
					label: localize('NIMBLE.levelCorrectionDialog.sheetWarning'),
					tooltip: format('NIMBLE.levelCorrectionDialog.sheetWarningTooltip', {
						level: String(missing[0]),
					}),
					intent: { kind: 'correctLevels' },
				}
			: null,
		edit: {
			label: localize(`${RAIL}.edit`),
			startHint: localize(`${RAIL}.editHint`),
			stopHint: localize(`${RAIL}.stopEditing`),
		},
	};
}
