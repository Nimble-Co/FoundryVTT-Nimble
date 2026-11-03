import { SYSTEM_ID } from '#system';
import { actorRules } from '#utils/actor/actorRules.js';
import applyConditionToActor from '#utils/actor/applyConditionToActor.js';
import { askActiveGm } from '#utils/askActiveGm.js';
import localize from '#utils/localize.js';
import { currentRoundId } from '../combat/perTurnUse.js';
import { countsAsAttack, recordAttack } from '../combat/rushedAttacks.js';

export const CONTROL_OPTIONS = ['iInsist', 'elementalAffliction', 'no', 'loseControl'] as const;
export type ControlOption = (typeof CONTROL_OPTIONS)[number];
export const AFFLICTIONS = ['charged', 'smoldering', 'slowed'] as const;

const FLAG = 'demandControl';
export const DEMAND_CONTROL_USED_FLAG = 'demandControlUsed';
const QUERY_NAME = `${SYSTEM_ID}.demandControl`;
const TEXT = 'NIMBLE.demandControl';

/** What the player chose in the window. */
export interface ControlChoice {
	option: ControlOption;
	cantripId?: string | null;
	creatureUuid?: string | null;
	protectedUuid?: string | null;
	condition?: (typeof AFFLICTIONS)[number];
	twice?: boolean;
	asReaction?: boolean;
}

interface ControlState {
	chosen: ControlOption[];
	round?: string;
	reactionRound?: string;
}

interface ControlRuleLike {
	type?: string;
	disabled?: boolean;
	test?(): boolean;
	opensOnUse?: boolean;
	oncePerRound?: boolean;
	cardRow?: boolean;
	ignoresDisadvantage?: boolean;
	triggerTwice?: boolean;
	label?: string;
	item?: { name?: string } | null;
}

interface ControlActor {
	uuid?: string;
	name?: string | null;
	isOwner?: boolean;
	rules?: unknown;
	items?: Iterable<{
		id?: string | null;
		name?: string | null;
		type?: string;
		system?: { tier?: number };
		activate?(options: object): Promise<unknown>;
	}>;
	getFlag?(scope: string, key: string): unknown;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
	unsetFlag?(scope: string, key: string): Promise<unknown>;
}

const stateOf = (actor: ControlActor): ControlState =>
	(actor.getFlag?.(SYSTEM_ID, FLAG) as ControlState | undefined) ?? { chosen: [] };

export function controlRules(actor: ControlActor | null | undefined): ControlRuleLike[] {
	return actorRules<ControlRuleLike>(actor).filter(
		(rule) => rule?.type === 'choiceTable' && !rule.disabled && rule.test?.() !== false,
	);
}

/** The options chosen since the last reset. */
export function chosenOptions(actor: ControlActor): ControlOption[] {
	return stateOf(actor).chosen ?? [];
}

/** H:957: the list starts again when all options were chosen. */
export function chosenAfter(chosen: ControlOption[], option: ControlOption): ControlOption[] {
	const next = [...new Set([...chosen, option])];
	return next.length >= CONTROL_OPTIONS.length ? [] : next;
}

/** Whether a 1/round feature was used this round. It is a report, not a block. */
export function usedThisRound(actor: ControlActor): boolean {
	const round = currentRoundId();
	return !!round && stateOf(actor).round === round;
}

export async function recordChoice(
	actor: ControlActor,
	option: ControlOption,
	reportsRound = false,
): Promise<void> {
	const state = stateOf(actor);
	await actor.setFlag?.(SYSTEM_ID, FLAG, {
		...state,
		chosen: chosenAfter(state.chosen ?? [], option),
		round: reportsRound ? (currentRoundId() ?? '') : (state.round ?? ''),
	});
}

/** Each reaction is 1/round (C:492). This one has no heroic reaction of its own to mark. */
export function reactionUsedThisRound(actor: ControlActor): boolean {
	const round = currentRoundId();
	return !!round && stateOf(actor).reactionRound === round;
}

export async function recordReaction(actor: ControlActor): Promise<void> {
	await actor.setFlag?.(SYSTEM_ID, FLAG, {
		...stateOf(actor),
		reactionRound: currentRoundId() ?? '',
	});
}

/** A reaction is performed when it is not your turn (C:492). */
export function isOwnTurn(actor: ControlActor): boolean {
	const combatant = game.combat?.started ? game.combat.combatant : null;
	const actorUuid = (actor as { uuid?: string }).uuid;
	return !!combatant?.actor && !!actorUuid && combatant.actor.uuid === actorUuid;
}

export async function resetChosen(actor: ControlActor): Promise<void> {
	if ((stateOf(actor).chosen ?? []).length > 0) await actor.unsetFlag?.(SYSTEM_ID, FLAG);
}

/** The window's rows, with what was chosen dimmed. */
export function optionRows(actor: ControlActor) {
	const chosen = chosenOptions(actor);
	return CONTROL_OPTIONS.map((id) => ({
		id,
		label: localize(`${TEXT}.options.${id}.label`),
		text: localize(`${TEXT}.options.${id}.text`),
		chosen: chosen.includes(id),
	}));
}

export function cantripsOf(actor: ControlActor) {
	return [...(actor.items ?? [])]
		.filter((item) => item.type === 'spell' && (item.system?.tier ?? 0) === 0)
		.map((item) => ({ id: item.id ?? '', name: item.name ?? '' }));
}

/** Whether what the window has is enough to do the option. */
export function choiceIsComplete(choice: ControlChoice): boolean {
	switch (choice.option) {
		case 'iInsist':
			return !!choice.cantripId;
		case 'elementalAffliction':
			return !!choice.creatureUuid && !!choice.condition;
		case 'no':
			return !!choice.creatureUuid && !!choice.protectedUuid;
		case 'loseControl':
			return true;
	}
}

const nameOf = (uuid: string | null | undefined): string =>
	(uuid ? (fromUuidSync(uuid as never) as { name?: string } | null)?.name : '') ?? '';

async function postCard(actor: ControlActor, system: object, whisperGm = false): Promise<unknown> {
	return ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor: actor as never }),
		type: 'demandControl',
		...(whisperGm ? { whisper: ChatMessage.getWhisperRecipients('GM').map((u) => u.id) } : {}),
		system: { actorUuid: actor.uuid ?? '', ...system },
	} as unknown as ChatMessage.CreateData);
}

interface QueryUser {
	query(name: string, data: object): Promise<unknown>;
}

async function applyAffliction(
	actor: ControlActor,
	creatureUuid: string,
	condition: string,
): Promise<void> {
	const creature = fromUuidSync(creatureUuid as never) as { isOwner?: boolean } | null;
	if (!creature) return;
	if (creature.isOwner) {
		await applyConditionToActor(creature as never, condition, { sourceActor: actor as never });
		return;
	}
	await askActiveGm(QUERY_NAME, {
		action: 'condition',
		actorUuid: actor.uuid,
		creatureUuid,
		condition,
	});
}

/**
 * Does the option, and says whether it was done. A granted cast has no card of
 * its own: the cast is the result, and its window keeps the choice of advantage.
 */
export async function applyControlChoice(
	actor: ControlActor,
	choice: ControlChoice,
): Promise<boolean> {
	switch (choice.option) {
		case 'iInsist': {
			const spell = [...(actor.items ?? [])].find((item) => item.id === choice.cantripId);
			const card = await spell?.activate?.({
				ignoreDisadvantage: true,
				grantedCannotMiss: localize(`${TEXT}.options.iInsist.label`),
			});
			if (card && countsAsAttack(spell as never)) await recordAttack(actor as never);
			return !!card;
		}
		case 'elementalAffliction': {
			if (!choice.creatureUuid || !choice.condition) return false;
			await applyAffliction(actor, choice.creatureUuid, choice.condition);
			await postCard(actor, {
				option: choice.option,
				text: localize(`${TEXT}.card.elementalAffliction`, {
					creature: nameOf(choice.creatureUuid),
					condition: localize(`NIMBLE.conditions.${choice.condition}`),
				}),
			});
			return true;
		}
		case 'no':
			await postCard(actor, {
				option: choice.option,
				text: localize(`${TEXT}.card.no`, {
					creature: nameOf(choice.creatureUuid),
					protected: nameOf(choice.protectedUuid),
				}),
			});
			return true;
		case 'loseControl':
			await postCard(
				actor,
				{ option: choice.option, text: localize(`${TEXT}.card.loseControl`) },
				true,
			);
			return true;
	}
}

/** The GM does the part only the GM can write, and a row opens a window on the user who clicks. */
export function registerDemandControlQuery(
	open: (actor: never, options: { locked?: ControlOption }) => Promise<void>,
): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: {
			action: 'condition' | 'open';
			actorUuid: string;
			creatureUuid?: string;
			condition?: string;
		}) => {
			const actor = fromUuidSync(data.actorUuid as never) as ControlActor | null;
			if (!actor) return false;
			if (data.action === 'open') {
				void open(actor as never, {});
				return true;
			}
			if (data.creatureUuid && data.condition) {
				await applyAffliction(actor, data.creatureUuid, data.condition);
			}
			return true;
		};
	});
}

/** Opens the window on the user who clicked a row. Another client can run the row. */
export async function openOnUser(userId: string, actorUuid: string): Promise<void> {
	const data = { action: 'open', actorUuid };
	if (userId === game.user?.id) {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<unknown>>;
		await queries[QUERY_NAME]?.(data as never);
		return;
	}
	const user = game.users?.get(userId) as unknown as QueryUser | undefined;
	await user?.query(QUERY_NAME, data);
}

interface SaveCardView {
	flags?: Record<string, Record<string, unknown> | undefined>;
	type?: string;
	system?: { reportedSaveResult?: string | null };
}

/** The creature whose effect was saved against, when this user can use its row now. */
export function saveRowActor(card: SaveCardView): ControlActor | null {
	const flags = card.flags?.[SYSTEM_ID];
	const causedBy = flags?.causedBy as string | undefined;
	if (!causedBy || flags?.[DEMAND_CONTROL_USED_FLAG]) return null;
	if (card.system?.reportedSaveResult !== 'succeeded') return null;
	const actor = fromUuidSync(causedBy as never) as ControlActor | null;
	if (!actor?.isOwner || !controlRules(actor).some((rule) => rule.cardRow)) return null;
	return actor;
}
