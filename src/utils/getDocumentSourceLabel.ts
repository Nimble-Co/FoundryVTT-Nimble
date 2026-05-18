export default function getDocumentSourceLabel(uuid: string): string {
	if (!uuid.startsWith('Compendium.')) return 'World';
	const packId = uuid.split('.').slice(1, 3).join('.');
	return (
		(game.packs.get(packId) as { metadata?: { label?: string } } | undefined)?.metadata?.label ??
		'Compendium'
	);
}
