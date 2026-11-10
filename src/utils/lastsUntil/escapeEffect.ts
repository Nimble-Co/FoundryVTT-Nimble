import type { SaveKeyType } from '#types/saveKey.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import localize from '#utils/localize.js';
import { checkResultOfCard } from '#utils/rolls/checkResult.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import type { EscapeSave } from '../../models/activeEffect/nimbleEffectChoices.js';

const ALL_SAVES: SaveKeyType[] = ['strength', 'dexterity', 'intelligence', 'will'];

/** The saves that an Escape allows. */
export function escapeSavesOf(saves: EscapeSave | string | null | undefined): SaveKeyType[] {
	if (saves === 'any') return ALL_SAVES;
	if (saves && (ALL_SAVES as string[]).includes(saves)) return [saves as SaveKeyType];
	return ['strength', 'dexterity'];
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
	effects: { get(id: string): EscapableEffect | undefined };
	rollSavingThrowToChat(
		save: SaveKeyType,
		options: { dc?: number },
	): Promise<{
		type: string;
		system: unknown;
		rolls?: { total?: number | null; terms: unknown[] }[];
	} | null>;
}

interface EscapableEffect {
	id: string | null;
	name: string;
	origin?: string | null;
	system?: { escape?: { dc?: string; saves?: string } };
	delete(): Promise<unknown>;
}

async function pickSave(saves: SaveKeyType[], name: string): Promise<SaveKeyType | null> {
	if (saves.length === 1) return saves[0];
	const labels = CONFIG.NIMBLE.savingThrows as unknown as Record<SaveKeyType, string>;
	const chosen: unknown = await foundry.applications.api.DialogV2.wait({
		window: { title: localize('NIMBLE.escape.title', { name }) },
		content: `<p>${localize('NIMBLE.escape.pick')}</p>`,
		buttons: saves.map((save) => ({ action: save, label: localize(labels[save]) })),
		rejectClose: false,
	} as never);
	return saves.includes(chosen as SaveKeyType) ? (chosen as SaveKeyType) : null;
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
 * The holder tries to Escape: the owner picks one of the allowed saves, the save rolls against the
 * DC, 1 action is spent in combat, and a success removes the effect. A save with no DC leaves the
 * effect for the table to remove. Only an effect on the actor itself can be escaped.
 */
export async function escapeEffect(
	actor: EscapingActor,
	effectId: string,
): Promise<'escaped' | 'held' | null> {
	const effect = actor.effects.get(effectId);
	if (!effect) return null;
	const escapeData = effect.system?.escape;
	const save = await pickSave(escapeSavesOf(escapeData?.saves), effect.name);
	if (!save) return null;
	const dc = escapeDcOfEffect(effect, actor);
	const card = await actor.rollSavingThrowToChat(save, dc === null ? {} : { dc });
	if (!card) return null;
	await spendOneAction(actor);
	const result = checkResultOfCard(
		card.type,
		card.system as Record<string, unknown>,
		card.rolls?.[0],
	);
	if (result !== 'succeeded' || dc === null) return 'held';
	await effect.delete();
	return 'escaped';
}
