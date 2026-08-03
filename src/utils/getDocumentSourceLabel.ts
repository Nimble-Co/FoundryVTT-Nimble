import getItemSource from './getItemSource.ts';

export default function getDocumentSourceLabel(uuid: string): string {
	if (getItemSource(uuid) === 'world') return 'World';
	const packId = uuid.split('.').slice(1, 3).join('.');
	return (
		(game.packs.get(packId) as { metadata?: { label?: string } } | undefined)?.metadata?.label ??
		'Compendium'
	);
}
