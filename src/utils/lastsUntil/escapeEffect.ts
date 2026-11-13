import type { ActorRollOptions } from '#documents/actor/actorInterfaces.js';
import type { SaveKeyType } from '#types/saveKey.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import localize from '#utils/localize.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import { ESCAPE_SAVES } from '../../models/activeEffect/nimbleEffectChoices.js';
import { ESCAPE_ROLL_FLAG, type EscapeRollLink } from './escapeFollow.js';

/** The saves that an Escape allows, in the order of the saves. With none, STR and DEX. */
export function escapeSavesOf(saves: readonly string[] | null | undefined): SaveKeyType[] {
	const allowed = ESCAPE_SAVES.filter((save) => saves?.includes(save));
	return allowed.length ? allowed : ['strength', 'dexterity'];
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
	rollSavingThrowToChat(
		save: SaveKeyType,
		options: Pick<ActorRollOptions, 'dc' | 'checkHint' | 'cardFlags'>,
	): Promise<unknown>;
}

interface EscapableEffect {
	id: string | null;
	name: string;
	origin?: string | null;
	system?: { escape?: { dc?: string; saves?: string[] } };
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
 * DC, and 1 action is spent in combat. The roll card names the effect, and the active GM ends it
 * when the card passes. Only an effect on the actor itself can be escaped.
 */
export async function escapeEffect(
	actor: EscapingActor,
	effectId: string,
): Promise<'rolled' | null> {
	const effect = actor.effects.get(effectId);
	if (!effect?.id) return null;
	const escapeData = effect.system?.escape;
	const save = await pickSave(escapeSavesOf(escapeData?.saves), effect.name);
	if (!save) return null;
	const dc = escapeDcOfEffect(effect, actor);
	const link: EscapeRollLink = {
		holderUuid: actor.uuid,
		holderName: actor.name ?? '',
		effectId: effect.id,
		effectName: effect.name,
		noDc: dc === null,
	};
	const card = await actor.rollSavingThrowToChat(save, {
		...(dc === null ? {} : { dc }),
		checkHint:
			dc === null
				? localize('NIMBLE.escape.hintNoDc', { effect: effect.name })
				: localize('NIMBLE.escape.hint', { effect: effect.name, dc: String(dc) }),
		cardFlags: { [ESCAPE_ROLL_FLAG]: link },
	});
	if (!card) return null;
	await spendOneAction(actor);
	return 'rolled';
}
