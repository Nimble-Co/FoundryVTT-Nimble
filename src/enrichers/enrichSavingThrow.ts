import createEnricherButton from './createEnricherButton.js';

export default function enrichSavingThrow(
	args: Record<string, string>,
	_options?: foundry.applications.ux.TextEditor.EnrichmentOptions,
) {
	const { enricherType } = args;

	const icon = 'fa-solid fa-dice-d20';
	const label = '';

	return createEnricherButton(enricherType, { icon, label });
}
