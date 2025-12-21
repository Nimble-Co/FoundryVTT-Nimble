import enrichCheck from './enrichCheck.js';
import enrichCondition from './enrichCondition.js';
import enrichSavingThrow from './enrichSavingThrow.js';
import parseEnricherArguments from './parseEnricherArguments.js';

export default async function parseEnricherInput(
	match: RegExpMatchArray,
	options?: foundry.applications.ux.TextEditor.EnrichmentOptions,
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
