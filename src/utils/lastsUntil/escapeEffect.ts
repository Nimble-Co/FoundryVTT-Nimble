import type { SaveKeyType } from '#types/saveKey.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import localize from '#utils/localize.js';
import { checkResultOfCard } from '#utils/rolls/checkResult.js';
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

interface EscapingActor {
	uuid: string;
	allApplicableEffects(): Iterable<EscapableEffect>;
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
 * DC, 1 action is spent in combat, and a success removes the effect. A save with no result (no DC
 * that is a number) leaves the effect for the table to remove.
 */
export async function escapeEffect(
	actor: EscapingActor,
	effectId: string,
): Promise<'escaped' | 'held' | null> {
	const effect = [...actor.allApplicableEffects()].find((entry) => entry.id === effectId);
	if (!effect) return null;
	const escapeData = effect.system?.escape;
	const save = await pickSave(escapeSavesOf(escapeData?.saves), effect.name);
	if (!save) return null;
	const dc = escapeDcOf(escapeData?.dc);
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
