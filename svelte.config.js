import { readFileSync } from 'node:fs';
import { sveltePreprocess } from 'svelte-preprocess';

const systemJson = JSON.parse(readFileSync('./public/system.json', 'utf8'));

// The one preprocess config for the Vite build and for IDE tooling
// (svelte-check, the Svelte VSCode extension). The rewrite turns
// `.system-nimble` in component <style lang="scss"> blocks into the system id
// before sass runs, the same as the SCSS importer in vite.config.mts.
const NAMESPACE_PATTERN = /\.system-nimble\b(?!-)/g;
const namespaceReplacement = `.system-${systemJson.id}`;
const rewriteNamespace = (source) => source.replace(NAMESPACE_PATTERN, namespaceReplacement);

const config = {
	compilerOptions: {
		runes: true,
	},
	preprocess: [
		{
			name: 'system-namespace-rewrite',
			style({ content, attributes }) {
				if (attributes.lang !== 'scss' && attributes.lang !== 'sass') return;
				return { code: rewriteNamespace(content) };
			},
		},
		sveltePreprocess({
			scss: {
				prependData: '@use "src/scss/base/functions" as *;',
			},
			typescript: {
				tsconfigFile: './tsconfig.json',
			},
		}),
	],
};

export default config;
