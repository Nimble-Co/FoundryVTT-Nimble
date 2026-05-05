import { readFileSync } from 'node:fs';
import { sveltePreprocess } from 'svelte-preprocess';

const systemJson = JSON.parse(readFileSync('./public/system.json', 'utf8'));

// Mirrors the namespace rewrite registered in vite.config.mts so IDE tooling
// (svelte-check, the Svelte VSCode extension, etc.) — which reads this file
// rather than Vite's config — sees the rebranded selectors. Without it,
// .system-nimble would appear unmodified in tooling-driven SCSS compilation.
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
				prependData: '@import "src/scss/base/_functions.scss";',
			},
			typescript: {
				tsconfigFile: './tsconfig.json',
			},
		}),
	],
};

export default config;
