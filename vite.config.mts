import { execSync } from 'node:child_process';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { defineConfig } from 'vitest/config';

const FOUNDRY_URL = process.env.FOUNDRY_URL ?? 'http://localhost:30000';
const FOUNDRY_WS_URL = FOUNDRY_URL.replace(/^https?/, (p) => (p === 'https' ? 'wss' : 'ws'));

let CURRENT_BRANCH = 'unknown';
try {
	const abbrevRef = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
	if (abbrevRef && abbrevRef !== 'HEAD') {
		CURRENT_BRANCH = abbrevRef;
	} else {
		const envBranch = process.env.GITHUB_REF_NAME ?? process.env.CI_COMMIT_REF_NAME;
		if (envBranch?.trim()) {
			CURRENT_BRANCH = envBranch.trim();
		} else {
			const showCurrent = execSync('git branch --show-current').toString().trim();
			if (showCurrent) {
				CURRENT_BRANCH = showCurrent;
			} else {
				CURRENT_BRANCH = execSync('git rev-parse --short HEAD').toString().trim() || 'unknown';
			}
		}
	}
} catch {
	// not a git repo or git not available
}

const branchWatchPlugin = {
	name: 'nimble-branch-watch',
	configureServer(server: {
		watcher: { add: (f: string) => void; on: (e: string, cb: (f: string) => void) => void };
		restart: () => void;
	}) {
		let gitHead: string | null = null;
		try {
			const raw = execSync('git rev-parse --git-path HEAD').toString().trim();
			gitHead = path.isAbsolute(raw) ? raw : path.resolve(__dirname, raw);
		} catch {
			// not a git repo, git not available, or worktree resolution failed
		}
		if (!gitHead) return;
		server.watcher.add(gitHead);
		server.watcher.on('change', (changedPath) => {
			if (changedPath === gitHead) {
				server.restart();
			}
		});
	},
};

const config = defineConfig({
	root: 'src/',
	base: '/systems/nimble/',
	publicDir: path.resolve(__dirname, 'public'),
	server: {
		port: 30001,
		open: '/',
		proxy: {
			// Explicit paths (Vite proxy keys are path prefixes; regex-like strings don't always match)
			'/systems/nimble/nimble.css': FOUNDRY_URL,
			'/systems/nimble/style.css': FOUNDRY_URL,
			'/systems/nimble/assets': FOUNDRY_URL,
			// During dev, Foundry loads the system stylesheet from system.json ("nimble.css").
			// Proxy it (and assets) back to the Foundry server.
			'^/systems/nimble/(assets|nimble\\.css|style\\.css)': FOUNDRY_URL,
			'^(?!/systems/nimble)': FOUNDRY_URL,
			'/socket.io': {
				target: FOUNDRY_WS_URL,
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
	define: {
		__BRANCH__: JSON.stringify(CURRENT_BRANCH),
	},
	esbuild: {
		keepNames: true,
	},
	plugins: [
		branchWatchPlugin,
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
