/**
 * Places content can be imported from.
 *
 * A stored credit holds the source id, never the label, so renaming a source
 * updates every sheet instead of leaving old text baked into documents.
 */

export type ImportSourceId = 'nimble-nexus';

interface ImportSource {
	label: string;
	creatorProfileUrl: (username: string) => string;
}

const IMPORT_SOURCES: Record<ImportSourceId, ImportSource> = {
	'nimble-nexus': {
		label: 'Nimble Nexus',
		creatorProfileUrl: (username) => `https://nimble.nexus/u/${encodeURIComponent(username)}`,
	},
};

export function getImportSource(id: string): ImportSource | undefined {
	return IMPORT_SOURCES[id as ImportSourceId];
}
