import type { ActorRollOptions } from '#documents/actor/actorInterfaces.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';
import { addCardEvents } from '#utils/chat/cardEvents.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import localize from '#utils/localize.js';
import { checkResultOfCard } from '#utils/rolls/checkResult.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import { ESCAPE_SAVES, ESCAPE_SKILLS } from '../../models/activeEffect/nimbleEffectChoices.js';
import { ESCAPE_ROLL_FLAG, type EscapeRollLink, escapeRulingEvent } from './escapeFollow.js';

interface EscapeData {
	dc?: string;
	noDc?: boolean;
	saves?: readonly string[];
	skills?: readonly string[];
}

export type EscapeRoll = { kind: 'save'; key: SaveKeyType } | { kind: 'skill'; key: SkillKeyType };

/** The effect has an Escape: a DC, or No DC on. A blank DC with No DC off is no Escape. */
export function hasEscape(system: { escape?: EscapeData } | null | undefined): boolean {
	return !!system?.escape?.dc?.trim() || !!system?.escape?.noDc;
}

/**
 * The rolls that an Escape allows: its saves, then its skills. A creature with no skills rolls the
 * save of each skill's stat instead (Core 241: the world affects you, so roll a save). With none,
 * STR and DEX.
 */
export function escapeRollsOf(
	escapeData: EscapeData | null | undefined,
	hasSkills: boolean,
): EscapeRoll[] {
	const saves = new Set(ESCAPE_SAVES.filter((save) => escapeData?.saves?.includes(save)));
	const skills = ESCAPE_SKILLS.filter((skill) => escapeData?.skills?.includes(skill));
	if (!hasSkills) {
		const statOf = CONFIG.NIMBLE.defaultSkillAbilities as Record<string, string>;
		for (const skill of skills) saves.add(statOf[skill] as SaveKeyType);
	}
	const rolls: EscapeRoll[] = ESCAPE_SAVES.filter((save) => saves.has(save)).map((key) => ({
		kind: 'save',
		key,
	}));
	if (hasSkills) for (const key of skills) rolls.push({ kind: 'skill', key });
	return rolls.length
		? rolls
		: [
				{ kind: 'save', key: 'strength' },
				{ kind: 'save', key: 'dexterity' },
			];
}

/** The Escape DC as a number; null when there is no DC or it is not a number. */
export function escapeDcOf(dc: unknown): number | null {
	const text = typeof dc === 'string' ? dc.trim() : typeof dc === 'number' ? String(dc) : '';
	if (!text) return null;
	const value = Number(text);
	return Number.isFinite(value) ? Math.floor(value) : null;
}

interface DcRoller {
	type: string;
	getRollData(): Record<string, unknown>;
}

/** The creature in the effect's origin (the actor, or the actor of the item), else the holder. */
function rollerOf(origin: string | null | undefined, holder: DcRoller | null): DcRoller | null {
	const document = origin
		? (fromUuidSync(origin as never, { strict: false }) as
				| (DcRoller & { documentName?: string; actor?: DcRoller | null })
				| null)
		: null;
	if (document?.documentName === 'Actor') return document;
	return document?.actor ?? holder;
}

/**
 * The Escape DC of the effect as a number. A formula reads the creature that applied the effect,
 * or the holder when there is none. Null when there is no DC.
 */
export function escapeDcOfEffect(
	effect: { origin?: string | null; system?: unknown },
	holder: DcRoller | null,
): number | null {
	const dc = (effect.system as { escape?: { dc?: string } } | undefined)?.escape?.dc;
	const value = escapeDcOf(dc);
	if (value !== null || !dc?.trim()) return value;
	return resolveSaveNodeDC(dc, rollerOf(effect.origin, holder));
}

interface EscapingActor extends DcRoller {
	uuid: string;
	name?: string | null;
	effects: { get(id: string): EscapableEffect | undefined };
	rollSavingThrowToChat(save: SaveKeyType, options: EscapeRollOptions): Promise<unknown>;
	/** Only a creature with skills has it. */
	rollSkillCheckToChat?(skill: SkillKeyType, options: EscapeRollOptions): Promise<unknown>;
}

type EscapeRollOptions = Pick<ActorRollOptions, 'dc' | 'checkHint' | 'cardFlags'>;

interface EscapableEffect {
	id: string | null;
	name: string;
	origin?: string | null;
	system?: { escape?: EscapeData };
}

interface RolledCard {
	id?: string | null;
	type: string;
	system: unknown;
	rolls?: { total?: number | null; terms: unknown[] }[];
}

const rollId = (roll: EscapeRoll) => `${roll.kind}:${roll.key}`;

function rollLabel(roll: EscapeRoll): string {
	if (roll.kind === 'save') {
		const save = localize(`NIMBLE.effectSheet.escape.saves.${roll.key}`);
		return localize('NIMBLE.escape.save', { save });
	}
	const skills = CONFIG.NIMBLE.skills as unknown as Record<string, string>;
	return localize('NIMBLE.escape.check', { skill: localize(skills[roll.key] ?? roll.key) });
}

async function pickRoll(rolls: EscapeRoll[], name: string): Promise<EscapeRoll | null> {
	if (rolls.length === 1) return rolls[0];
	const chosen: unknown = await foundry.applications.api.DialogV2.wait({
		window: { title: localize('NIMBLE.escape.title', { name }) },
		content: `<p>${localize('NIMBLE.escape.pick')}</p>`,
		buttons: rolls.map((roll) => ({ action: rollId(roll), label: rollLabel(roll) })),
		rejectClose: false,
	} as never);
	return rolls.find((roll) => rollId(roll) === chosen) ?? null;
}

function rollToChat(actor: EscapingActor, roll: EscapeRoll, options: EscapeRollOptions) {
	if (roll.kind === 'skill' && actor.rollSkillCheckToChat) {
		return actor.rollSkillCheckToChat(roll.key, options);
	}
	return actor.rollSavingThrowToChat(roll.key as SaveKeyType, options);
}

async function spendOneAction(actor: EscapingActor): Promise<void> {
	const combat = game.combat;
	const combatant = combat?.combatants.find(
		(entry) => (entry.actor as { uuid?: string } | null)?.uuid === actor.uuid,
	);
	if (combat?.started && combatant?.id) {
		await consumeCombatantAction({ combat, combatantId: combatant.id });
	}
}

/**
 * The holder tries to Escape: the owner picks one of the allowed rolls, it rolls against the DC,
 * and 1 action is spent in combat. The roll card names the effect, and the active GM ends it when
 * the card passes. With no DC, a roll that settles nothing gets a line for the table to judge.
 * Only an effect on the actor itself can be escaped.
 */
export async function escapeEffect(
	actor: EscapingActor,
	effectId: string,
): Promise<'rolled' | null> {
	const effect = actor.effects.get(effectId);
	if (!effect?.id) return null;
	const rolls = escapeRollsOf(
		effect.system?.escape,
		typeof actor.rollSkillCheckToChat === 'function',
	);
	const roll = await pickRoll(rolls, effect.name);
	if (!roll) return null;
	const dc = escapeDcOfEffect(effect, actor);
	const link: EscapeRollLink = {
		holderUuid: actor.uuid,
		holderName: actor.name ?? '',
		effectId: effect.id,
		effectName: effect.name,
		noDc: dc === null,
	};
	const card = (await rollToChat(actor, roll, {
		...(dc === null ? {} : { dc }),
		checkHint:
			dc === null
				? localize('NIMBLE.escape.hintNoDc', { effect: effect.name })
				: localize('NIMBLE.escape.hint', { effect: effect.name, dc: String(dc) }),
		cardFlags: { [ESCAPE_ROLL_FLAG]: link },
	})) as RolledCard | null;
	if (!card) return null;
	await spendOneAction(actor);
	const settled = checkResultOfCard(
		card.type,
		card.system as Record<string, unknown>,
		card.rolls?.[0],
	);
	if (link.noDc && settled === null) {
		await addCardEvents(card as never, [escapeRulingEvent(link, 'waiting')]);
	}
	return 'rolled';
}
