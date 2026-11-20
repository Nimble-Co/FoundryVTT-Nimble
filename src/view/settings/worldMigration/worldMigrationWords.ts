import localize from '#utils/localize.js';
import type { Holder } from '../../../migration/planMigration.js';

type WordData = Record<string, string | number>;

/** One piece of a localized sentence; `strong` pieces show in bold. */
interface PhrasePart {
	text: string;
	strong: boolean;
}

function stringValues(data: WordData): Record<string, string> {
	return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
}

function windowWord(key: string, data: WordData = {}): string {
	return localize(`NIMBLE.migration.window.${key}`, stringValues(data));
}

function reportWord(key: string, data: WordData = {}): string {
	return localize(`NIMBLE.migration.report.${key}`, stringValues(data));
}

function progressWord(key: string, data: WordData = {}): string {
	return localize(`NIMBLE.migration.progress.${key}`, stringValues(data));
}

/** A window sentence split at its placeholders, so the template can bold some values. */
function windowPhrase(key: string, data: WordData, strongKeys: string[]): PhrasePart[] {
	const template = localize(`NIMBLE.migration.window.${key}`);
	return template
		.split(/\{(\w+)\}/)
		.map((piece, index) =>
			index % 2 === 0
				? { text: piece, strong: false }
				: { text: String(data[piece] ?? ''), strong: strongKeys.includes(piece) },
		)
		.filter((part) => part.text !== '');
}

/** Where a copy is, for the report: "on Goblin", "in the sidebar". */
function whereLabel(holder: Holder): string {
	switch (holder.kind) {
		case 'actor':
			return reportWord('whereActor', { name: holder.actorName ?? '' });
		case 'token':
			return reportWord('whereToken', {
				name: holder.actorName ?? '',
				scene: holder.sceneName ?? '',
			});
		case 'compendium':
			return reportWord('whereCompendium', { pack: holder.packLabel ?? '' });
		default:
			return reportWord('whereSidebar');
	}
}

function formatDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export { formatDate, progressWord, reportWord, whereLabel, windowPhrase, windowWord };
export type { PhrasePart };
