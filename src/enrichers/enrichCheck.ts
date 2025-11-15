import createEnricherButton from './createEnricherButton';

export default function enrichCheck(
	args: Record<string, string>,
	_options?: foundry.applications.ux.TextEditor.implementation.EnrichmentOptions,
) {
	const { enricherType } = args;

	const icon = 'fa-solid fa-dice-d20';
	const label = '';

	return createEnricherButton(enricherType, { icon, label });
}
