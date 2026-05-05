import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { defineConfig } from 'vitest/config';

const systemJson = JSON.parse(readFileSync(path.resolve(__dirname, 'public/system.json'), 'utf8'));
const systemRoot = `/systems/${systemJson.id}`;
const systemBase = `${systemRoot}/`;

// Rewrites `.system-nimble` → `.system-<id>` in every SCSS unit at sass
// compile time, so source files keep the literal `.system-nimble` selector
// without authors needing to know about a build-time substitution.
//
// Mechanism: register our importer as `sassOptions.importer` (singular). Sass
// associates that importer with the entry source, and relative `@use` paths
// inside it cascade through our canonicalize first — see
// https://sass-lang.com/documentation/js-api/interfaces/importer/ ("Sass first
// attempts to resolve the URL relative to ... the original importer").
const NAMESPACE_PATTERN = /\.system-nimble\b(?!-)/g;
const namespaceReplacement = `.system-${systemJson.id}`;
const rewriteNamespace = (source: string) =>
	source.replace(NAMESPACE_PATTERN, namespaceReplacement);

const namespaceRewriteImporter = {
	canonicalize(url: string) {
		// Sass passes either a bare/relative path (e.g. `components/foo`) or an
		// already-resolved `file://` URL (sass's implicit URL importer resolves
		// the @use target against the parent's URL before delegating to us).
		// Either way, we need to find a real file via sass's partial-resolution
		// rules and return its canonical file:// URL.
		let basePath: string;
		if (url.startsWith('file:')) {
			basePath = fileURLToPath(new URL(url));
		} else if (path.isAbsolute(url)) {
			basePath = url;
		} else {
			// Bare relative path with no containing URL — uncommon for entries.
			basePath = path.resolve(url);
		}
		const dir = path.dirname(basePath);
		const filename = path.basename(basePath);
		const candidates = [
			path.join(dir, `_${filename}.scss`),
			path.join(dir, `${filename}.scss`),
			path.join(dir, filename, '_index.scss'),
			path.join(dir, filename, 'index.scss'),
		];
		const resolved = candidates.find(existsSync);
		return resolved ? pathToFileURL(resolved) : null;
	},
	load(canonicalUrl: URL) {
		return {
			contents: rewriteNamespace(readFileSync(fileURLToPath(canonicalUrl), 'utf-8')),
			syntax: 'scss' as const,
			sourceMapUrl: canonicalUrl,
		};
	},
};

const scssRewriteOptions = {
	additionalData: (source: string) => rewriteNamespace(source),
	importer: namespaceRewriteImporter,
};

const config = defineConfig({
	root: 'src/',
	base: systemBase,
	publicDir: path.resolve(__dirname, 'public'),
	server: {
		port: 30001,
		open: '/',
		// Allow Vite's dev-mode `@fs/` to serve files from the project root
		// (notably `public/system.json`, which `src/utils/systemId.ts` imports).
		// Without this, Vite restricts `@fs/` to the `root: 'src/'` directory and
		// the JSON import 404s in dev mode while production builds work.
		fs: {
			allow: [path.resolve(__dirname)],
		},
		proxy: {
			// Explicit paths (Vite proxy keys are path prefixes; regex-like strings don't always match)
			[`${systemBase}nimble.css`]: 'http://localhost:30000',
			[`${systemBase}style.css`]: 'http://localhost:30000',
			[`${systemBase}assets`]: 'http://localhost:30000',
			// During dev, Foundry loads the system stylesheet from system.json ("nimble.css").
			// Proxy it (and assets) back to the Foundry server.
			[`^${systemBase}(assets|nimble\\.css|style\\.css)`]: 'http://localhost:30000',
			[`^(?!${systemRoot})`]: 'http://localhost:30000',
			'/socket.io': {
				target: 'ws://localhost:30000',
				ws: true,
			},
		},
	},
	build: {
		reportCompressedSize: true,
		outDir: path.resolve(__dirname, 'dist'),
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			external: [/^\/icons\//],
		},
		lib: {
			name: 'Nimble 2',
			entry: path.resolve(__dirname, 'src/nimble.ts'),
			formats: ['es'],
			fileName: 'nimble',
		},
	},
	esbuild: {
		keepNames: true,
	},
	css: {
		preprocessorOptions: {
			scss: scssRewriteOptions,
		},
	},
	plugins: [
		svelte({
			configFile: path.resolve(__dirname, 'svelte.config.js'),
			dynamicCompileOptions({ filename }) {
				if (filename.includes('node_modules')) {
					return { runes: false };
				}
			},
			preprocess: [
				// Rewrites `.system-nimble` in component <style lang="scss"> blocks
				// before they hit sass. Component blocks don't @use our partials,
				// so a string-level rewrite covers them — no sass importer needed.
				{
					name: 'system-namespace-rewrite',
					style({ content, attributes }) {
						if (attributes.lang !== 'scss' && attributes.lang !== 'sass') return;
						return { code: rewriteNamespace(content) };
					},
				},
				sveltePreprocess({
					typescript: {
						tsconfigFile: './tsconfig.json',
					},
				}),
			],
			onwarn: (warning, handler) => {
				// Suppress `a11y-missing-attribute` for missing href in <a> links.
				// Foundry doesn't follow accessibility rules.
				if (warning.message.includes('<a> element should have an href attribute')) return;
				if (warning.code === 'a11y-click-events-have-key-events') return;

				// Suppress a11y warnings from third-party libraries in node_modules
				if (warning.code?.startsWith('a11y') && warning.filename?.includes('node_modules')) return;

				// eslint-disable-next-line no-console
				console.log(warning);

				// Let Rollup handle all other warnings normally.
				handler?.(warning);
			},
		}),
	],
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		root: '.',
		setupFiles: ['./tests/setup.ts'],
		server: {
			deps: {
				inline: ['svelte'],
			},
		},
	},
	resolve: {
		conditions: ['browser'],
		alias: {
			'#lib': path.resolve(__dirname, 'lib'),
			'#managers': path.resolve(__dirname, 'src/managers'),
			'#stores': path.resolve(__dirname, 'src/stores'),
			'#types': path.resolve(__dirname, 'types'),
			'#utils': path.resolve(__dirname, 'src/utils'),
			'#view': path.resolve(__dirname, 'src/view'),
		},
	},
});

export default config;
