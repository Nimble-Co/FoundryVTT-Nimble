import localize from '#utils/localize.js';
import type { Holder } from '../../../migration/planMigration.js';

type WordData = Record<string, string | number>;

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

export { formatDate, progressWord, reportWord, whereLabel, windowWord };
