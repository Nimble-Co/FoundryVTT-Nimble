import parseEnricherInput from './parseEnricherInput';

export default function registerCustomEnrichers() {
	const enricherTypes = ['check', 'savingThrow', 'condition'];

	CONFIG.TextEditor.enrichers.push({
		/**
		 * pattern: \[\[\/(?<enricherType>\w+)(?<argString>( +\w+=([\w\d]+|"[\w\d ]+"))*)\]\]
		 * matches: [[/type arg1=val1 arg2=val2 arg3="val 3"]]
		 */
		pattern: new RegExp(
			`\\[\\[\\/(?<enricherType>${enricherTypes.join('|')})(?<argString>( +\\w+=([\\w\\d]+|"[\\w\\d ]+"))*)\\]\\]`,
			'gi',
		),
		enricher: parseEnricherInput,
	});
}
