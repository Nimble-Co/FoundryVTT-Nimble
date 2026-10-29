import { plainText } from '../shared/plainText.ts';
import type { MonsterActorLike, MonsterSheetContext } from './monsterSource.ts';

export interface MonsterNotesTabView {
	/** the `prose-mirror` editor: it saves to `field` through the sheet form */
	notes: { label: string; field: string; value: string; enriched: string; empty: string | null };
	/** the import credit line, as HTML; empty when the monster was not imported */
	credit: string;
}

/** The Notes tab: the notes, and the import credit line at the bottom. */
export function monsterNotesTab(
	actor: MonsterActorLike,
	context: MonsterSheetContext,
): MonsterNotesTabView {
	const { localize } = context;
	const { description } = actor.system;
	return {
		notes: {
			label: localize('NIMBLE.actorSheet.monster.notes.label'),
			field: 'system.description',
			value: description,
			enriched: context.enrichedNotes,
			empty: plainText(description) ? null : localize('NIMBLE.actorSheet.monster.notes.none'),
		},
		credit: context.importCredit,
	};
}
