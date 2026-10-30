import { readFileSync } from 'node:fs';
import type { StorybookConfig } from '@storybook/svelte-vite';
import type { Plugin } from 'vite';

// The Svelte docgen reads the props but not the `<!-- @component -->` comment, so the Docs pages had no description.
function componentDescription(): Plugin {
	return {
		name: 'nimble-component-description',
		enforce: 'post',
		transform(code, id) {
			const file = id.split('?')[0];
			if (!file.endsWith('.svelte') || file.endsWith('.stories.svelte')) return;
			const name = /;(\w+)\.__docgen = /.exec(code)?.[1];
			if (!name) return;
			const text = /<!--\s*@component\s*([\s\S]*?)-->/.exec(readFileSync(file, 'utf8'))?.[1].trim();
			if (!text) return;
			return {
				code: `${code}\n;${name}.__docgen.description = ${JSON.stringify(text)};\n`,
				map: null,
			};
		},
	};
}

const config: StorybookConfig = {
	stories: ['../**/*.mdx', '../**/*.stories.svelte'],
	addons: ['@storybook/addon-svelte-csf', '@storybook/addon-docs'],
	framework: {
		name: '@storybook/svelte-vite',
		options: { builder: { viteConfigPath: 'vite.config.mts' } },
	},
	// Only the files that the stories need, not the whole system public folder.
	staticDirs: [
		{ from: '../../public/fonts', to: '/fonts' },
		{ from: '../../public/assets/magicItems', to: '/assets/magicItems' },
		{ from: '../../public/assets/classImages', to: '/assets/classImages' },
		{ from: '../../public/assets/monsterImages', to: '/assets/monsterImages' },
	],
	core: { disableTelemetry: true },
	viteFinal: (config) => ({
		...config,
		publicDir: false,
		plugins: [...(config.plugins ?? []), componentDescription()],
	}),
};

export default config;
