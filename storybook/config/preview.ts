import '@fortawesome/fontawesome-free/css/all.min.css';
import '../../src/scss/main.scss';
import './preview.css';
import type { Preview } from '@storybook/svelte-vite';
import { installI18n } from '../stubs/i18n';
import { installTooltips } from '../stubs/tooltip';
import Frame from './Frame.svelte';

installI18n();
installTooltips();

const preview: Preview = {
	globalTypes: {
		theme: {
			description: 'Foundry theme. Every part must work in both.',
			toolbar: {
				title: 'Theme',
				icon: 'mirror',
				items: [
					{ value: 'light', title: 'Light theme' },
					{ value: 'dark', title: 'Dark theme' },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: { theme: 'dark' },
	decorators: [
		(_story, context) => {
			const dark = context.globals.theme !== 'light';
			document.documentElement.classList.toggle('theme-dark', dark);
			document.documentElement.classList.toggle('theme-light', !dark);
			return {
				Component: Frame,
				props: { chrome: !!context.parameters.chrome, width: context.parameters.width ?? '' },
			};
		},
	],
	parameters: {
		layout: 'padded',
		controls: { expanded: true, matchers: { color: /(background|color)$/i } },
		options: {
			storySort: {
				order: [
					'Parts',
					['Lines', 'Rows', 'Rail', 'Sheet'],
					'Foundations',
					['Colors', 'Typography', 'Borders', 'Mono'],
				],
			},
		},
	},
	tags: ['autodocs'],
};

export default preview;
