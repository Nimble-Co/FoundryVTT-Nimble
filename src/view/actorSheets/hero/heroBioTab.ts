import { plainText } from '../shared/plainText.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const BIO = 'NIMBLE.actorSheet.hero.bio';

export type HeroDetail = 'age' | 'height' | 'weight' | 'gender';

const DETAILS: HeroDetail[] = ['age', 'height', 'weight', 'gender'];

export interface HeroBioTabView {
	fields: { detail: HeroDetail; label: string; value: string }[];
	/** the `prose-mirror` editor: it saves to `field` through the sheet form */
	notes: { label: string; field: string; value: string; enriched: string; empty: string | null };
}

/** The Bio tab: four details and the notes. */
export function heroBioTab(actor: HeroActorLike, context: HeroSheetContext): HeroBioTabView {
	const { localize } = context;
	const { details } = actor.system;
	return {
		fields: DETAILS.map((detail) => ({
			detail,
			label: localize(`${BIO}.${detail}`),
			value: details[detail],
		})),
		notes: {
			label: localize(`${BIO}.notes`),
			field: 'system.details.notes',
			value: details.notes,
			enriched: context.enrichedNotes,
			empty: plainText(details.notes) ? null : localize(`${BIO}.noNotes`),
		},
	};
}
