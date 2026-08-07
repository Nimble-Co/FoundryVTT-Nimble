import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'Nimble FoundryVTT',
	description: 'Documentation hub for the Nimble FoundryVTT system',

	// Exclude agent-only docs and reference partials (inlined by the generator) from the site build
	srcExclude: ['PROJECT_CONTEXT.md', 'documentation/reference/_partials/**'],

	// Ignore dead links from included CONTRIBUTING.md (repo-relative links to source files)
	ignoreDeadLinks: true,

	// Set base path for GitHub Pages, update if using a custom domain
	base: '/FoundryVTT-Nimble/',

	head: [['link', { rel: 'icon', type: 'image/x-icon', href: '/FoundryVTT-Nimble/favicon.ico' }]],

	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Documentation', link: '/documentation/' },
			{ text: 'Contributing', link: '/contributing' },
			{
				text: 'Guides',
				items: [
					{ text: 'Code Style Guide', link: '/STYLE_GUIDE' },
					{ text: 'Release Guide', link: '/RELEASE_GUIDE' },
				],
			},
			{ text: 'System', link: '/system/' },
			{
				text: 'Planning',
				items: [
					{ text: 'Project Vision', link: '/planning/product-vision' },
					{ text: 'Architecture', link: '/planning/architecture' },
					{
						text: 'UX Design',
						link: '/planning/ux-design-specification',
						items: [{ text: 'Design Directions', link: '/planning/ux-design-directions' }],
					},
					{ text: 'Epics & Stories', link: '/planning/epics' },
				],
			},
		],

		sidebar: {
			// GM & player documentation gets its own sidebar
			'/documentation/': [
				{
					text: 'Getting Started',
					items: [
						{ text: 'Welcome', link: '/documentation/' },
						{ text: 'Installation & First Steps', link: '/documentation/installation' },
						{ text: 'Core Concepts', link: '/documentation/core-concepts' },
					],
				},
				{
					text: 'Playing the Game',
					items: [
						{ text: 'Creating a Character', link: '/documentation/characters/creation' },
						{ text: 'The Character Sheet', link: '/documentation/characters/character-sheet' },
						{ text: 'Leveling Up', link: '/documentation/characters/advancement' },
						{ text: 'Dice Rolls & Chat Cards', link: '/documentation/playing/dice-and-chat' },
						{ text: 'Conditions', link: '/documentation/playing/conditions' },
						{ text: 'Rest & Recovery', link: '/documentation/playing/rest-and-recovery' },
					],
				},
				{
					text: 'Running the Game',
					items: [
						{ text: 'Running Combat', link: '/documentation/gm/combat' },
						{ text: 'Monsters, Minions & Solos', link: '/documentation/gm/monsters' },
						{ text: 'Importing & Exporting', link: '/documentation/gm/import-export' },
						{ text: 'Macros & the Hotbar', link: '/documentation/gm/macros' },
						{ text: 'Settings', link: '/documentation/gm/settings' },
					],
				},
				{
					text: 'Homebrewing',
					items: [
						{ text: "What You Can (and Can't) Change", link: '/documentation/homebrew/' },
						{ text: 'Weapons, Armor & Gear', link: '/documentation/homebrew/items' },
						{ text: 'Item Activations & Effects', link: '/documentation/homebrew/activations' },
						{ text: 'Spells', link: '/documentation/homebrew/spells' },
						{ text: 'Monsters', link: '/documentation/homebrew/monsters' },
						{ text: 'Character Options', link: '/documentation/homebrew/character-options' },
						{ text: 'Inline Roll Buttons', link: '/documentation/homebrew/enrichers' },
					],
				},
				{
					text: 'The Rules Builder',
					items: [
						{ text: 'Rules Builder Basics', link: '/documentation/rules-builder/' },
						{ text: 'Conditions & Predicates', link: '/documentation/rules-builder/predicates' },
						{ text: 'Formulas & References', link: '/documentation/rules-builder/formulas' },
					],
				},
				{
					text: 'Reference',
					items: [
						{ text: 'Rules: Bonuses', link: '/documentation/reference/rules-bonuses' },
						{ text: 'Rules: Triggers', link: '/documentation/reference/rules-triggers' },
						{ text: 'Rules: Grants', link: '/documentation/reference/rules-grants' },
						{ text: 'Rules: Conditions', link: '/documentation/reference/rules-conditions' },
						{ text: 'Rules: Resources', link: '/documentation/reference/rules-resource' },
						{ text: 'Rules: Notes', link: '/documentation/reference/rules-notes' },
						{ text: 'Settings', link: '/documentation/reference/settings' },
						{ text: 'Conditions', link: '/documentation/reference/conditions' },
					],
				},
			],

			// Developer/contributor sidebar for everything else
			'/': [
				{
					text: 'Getting Started',
					items: [
						{ text: 'Introduction', link: '/' },
						{ text: 'Contributing', link: '/contributing' },
					],
				},
				{
					text: 'Guides',
					items: [
						{ text: 'Code Style Guide', link: '/STYLE_GUIDE' },
						{ text: 'Release Guide', link: '/RELEASE_GUIDE' },
					],
				},
				{
					text: 'System',
					items: [{ text: 'Overview', link: '/system/' }],
				},
				{
					text: 'Planning',
					collapsed: true,
					items: [
						{ text: 'Project Vision', link: '/planning/product-vision' },
						{ text: 'Architecture', link: '/planning/architecture' },
						{
							text: 'UX Design',
							link: '/planning/ux-design-specification',
							items: [{ text: 'Design Directions', link: '/planning/ux-design-directions' }],
						},
						{ text: 'Epics & Stories', link: '/planning/epics' },
					],
				},
			],
		},

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/Nimble-Co/FoundryVTT-Nimble' },
			{ icon: 'discord', link: 'https://discord.gg/SxVmHpu34R' },
		],

		search: {
			provider: 'local',
		},

		editLink: {
			pattern: 'https://github.com/Nimble-Co/FoundryVTT-Nimble/edit/main/docs/:path',
			text: 'Edit this page on GitHub',
		},

		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2026 Nimble Co.',
		},
	},
});
