import enrichCheck from './enrichCheck';
import enrichCondition from './enrichCondition';
import enrichSavingThrow from './enrichSavingThrow';
import parseEnricherArguments from './parseEnricherArguments';

export default async function parseEnricherInput(
	match: RegExpMatchArray,
	options?: foundry.applications.ux.TextEditor.implementation.EnrichmentOptions,
): Promise<HTMLElement | null> {
	const { enricherType, argString } = match.groups as { enricherType: string; argString: string };

	const args = parseEnricherArguments(argString);
	args.enricherType = enricherType.toLowerCase();

	switch (enricherType) {
		case 'check':
			return enrichCheck(args, options);
		case 'save':
			return enrichSavingThrow(args, options);
		case 'condition':
			return enrichCondition(args, options);
		default:
			return null;
	}
}
