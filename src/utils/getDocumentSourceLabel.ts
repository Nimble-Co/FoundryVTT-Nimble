import getItemSource from './getItemSource.ts';
import localize from './localize.js';

export default function getDocumentSourceLabel(uuid: string): string {
	// A pack supplies its own label; the world has none, so it borrows the source badge's wording.
	if (getItemSource(uuid) === 'world') {
		return localize('NIMBLE.classSheet.progressionSourceTagWorldLabel');
	}

	const packId = uuid.split('.').slice(1, 3).join('.');
	return (
		(game.packs.get(packId) as { metadata?: { label?: string } } | undefined)?.metadata?.label ??
		localize('NIMBLE.classSheet.progressionSourceTagPackLabel')
	);
}
