import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
	root: 'src/',
	base: '/systems/nimble/',
	publicDir: path.resolve(__dirname, 'public'),
	server: {
		port: 30001,
		open: '/',
		proxy: {
			// Explicit paths (Vite proxy keys are path prefixes; regex-like strings don't always match)
			'/systems/nimble/nimble.css': 'http://localhost:30000',
			'/systems/nimble/style.css': 'http://localhost:30000',
			'/systems/nimble/assets': 'http://localhost:30000',
			// During dev, Foundry loads the system stylesheet from system.json ("nimble.css").
			// Proxy it (and assets) back to the Foundry server.
			'^/systems/nimble/(assets|nimble\\.css|style\\.css)': 'http://localhost:30000',
			'^(?!/systems/nimble)': 'http://localhost:30000',
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
	plugins: [
		svelte({
			configFile: path.resolve(__dirname, 'svelte.config.js'),
			dynamicCompileOptions({ filename }) {
				if (filename.includes('node_modules')) {
					return { runes: false };
				}
			},
			preprocess: sveltePreprocess({
				typescript: {
					tsconfigFile: './tsconfig.json',
				},
			}),
			onwarn: (warning, handler) => {
				// Suppress `a11y-missing-attribute` for missing href in <a> links.
				// Foundry doesn't follow accessibility rules.
				if (warning.message.includes('<a> element should have an href attribute')) return;
				if (warning.code === 'a11y-click-events-have-key-events') return;

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
