<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import localize from '#utils/localize.js';
	import type { HeroActorLike, HeroSheetContext } from '#view/actorSheets/hero/heroSource.ts';
	import type { HeroTabId } from '#view/actorSheets/hero/heroFrame.ts';
	import {
		blankHero,
		containerHero,
		dicePoolContext,
		dicePoolHero,
		effectsContext,
		effectsHero,
		featureHero,
		heroContext,
		heroTurn,
		manaCaster,
	} from '../../tests/fixtures/actorSheets/heroFixtures.ts';
	import HeroSheetStory from './HeroSheetStory.svelte';

	interface Args {
		width: number;
		height: number;
		editing: boolean;
		combat: 'out' | 'yourTurn' | 'notYourTurn';
		pools: boolean;
		/** the tab at the start */
		tab: HeroTabId;
		/**
		 * blank: the hero of the Core stories (with pools: a caster); dicePool: Fury Dice; mana: a Mage;
		 * containers: a backpack and gear; features: a level 3 Berserker; effects: Rage, Bless, Dazed
		 */
		actor: 'blank' | 'dicePool' | 'mana' | 'containers' | 'features' | 'effects';
		/** both themes side by side */
		both: boolean;
		/** the hero has Inspiration */
		inspired: boolean;
	}

	const { Story } = defineMeta({
		title: 'Sheets/Character sheet',
		args: {
			width: 720,
			height: 850,
			editing: false,
			combat: 'out',
			pools: false,
			tab: 'core',
			actor: 'blank',
			both: false,
			inspired: false,
		},
		argTypes: {
			width: { control: { type: 'select' }, options: [390, 460, 600, 720, 960] },
			height: { control: { type: 'select' }, options: [650, 850] },
			combat: { control: { type: 'inline-radio' }, options: ['out', 'yourTurn', 'notYourTurn'] },
			tab: {
				control: { type: 'select' },
				options: [
					'core',
					'actions',
					'features',
					'inventory',
					'spells',
					'effects',
					'bio',
					'settings',
				],
			},
			actor: {
				control: { type: 'select' },
				options: ['blank', 'dicePool', 'mana', 'containers', 'features', 'effects'],
			},
		},
		parameters: { layout: 'fullscreen' },
	});

	const perform = fn().mockName('perform');

	function context(args: Args): HeroSheetContext {
		const overrides: Partial<HeroSheetContext> = {
			localize: (key) => localize(key),
			format: (key, data) => localize(key, data),
			combat:
				args.combat === 'out'
					? null
					: heroTurn({ isTurn: args.combat === 'yourTurn', actions: { pendingDelta: 1 } }),
			targets: args.combat === 'out' ? [] : ['Goblin'],
			missingLevelSelections: args.pools ? [3] : [],
		};
		if (args.pools) {
			overrides.dicePools = [
				{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [5, 2] },
			];
			overrides.chargePools = [
				{
					id: 'combatDice',
					label: 'Combat Dice',
					current: 2,
					max: 3,
					dieSize: 'd8',
					hidden: false,
					showAsResource: true,
				},
			];
		}
		if (args.actor === 'effects') return effectsContext(overrides);
		return args.actor === 'dicePool' ? dicePoolContext(overrides) : heroContext(overrides);
	}

	const hero = blankHero({
		img: 'assets/classImages/berserker.webp',
		system: { attributes: { hp: { value: 9 }, wounds: { value: 1 } } },
	});
	const caster = blankHero({
		img: 'assets/classImages/berserker.webp',
		system: { resources: { mana: { current: 3, max: 5 } } },
	});
	const furyHero = dicePoolHero({ img: 'assets/classImages/berserker.webp' });
	const mage = manaCaster({ img: 'assets/classImages/mage.webp' });
	const packer = containerHero({
		img: 'assets/classImages/berserker.webp',
		system: {
			details: { age: '31', height: '6 ft', notes: '<p>Left the hold after the mine fell.</p>' },
		},
	});
	const veteran = featureHero({ img: 'assets/classImages/berserker.webp' });
	const raging = effectsHero({ img: 'assets/classImages/berserker.webp' });

	function actorOf(args: Args): HeroActorLike {
		const actor = chosenActor(args);
		if (!args.inspired) return actor;
		const { system } = actor;
		return {
			...actor,
			system: { ...system, resources: { ...system.resources, inspiration: true } },
		};
	}

	function chosenActor(args: Args): HeroActorLike {
		if (args.actor === 'dicePool') return furyHero;
		if (args.actor === 'mana') return mage;
		if (args.actor === 'containers') return packer;
		if (args.actor === 'features') return veteran;
		if (args.actor === 'effects') return raging;
		return args.pools ? caster : hero;
	}
</script>

{#snippet sheet(args: Args, theme?: string)}
	<HeroSheetStory
		source={() => ({ actor: actorOf(args), context: context(args) })}
		{perform}
		width={args.width}
		height={args.height}
		editing={args.editing}
		tab={args.tab}
		{theme}
	/>
{/snippet}

{#snippet template(args: Args)}
	{#if args.both}
		<div style="display: flex; flex-wrap: wrap; gap: 16px; padding: 16px;">
			{@render sheet(args, 'theme-light')}
			{@render sheet(args, 'theme-dark')}
		</div>
	{:else}
		<div style="padding: 16px;">{@render sheet(args)}</div>
	{/if}
{/snippet}

<Story name="Wide" {template} />
<Story name="Narrow" args={{ width: 390 }} {template} />
<Story name="Edit mode" args={{ editing: true }} {template} />
<Story name="Your turn" args={{ combat: 'yourTurn' }} {template} />
<Story name="Not your turn" args={{ combat: 'notYourTurn', width: 390 }} {template} />
<Story name="Mana, pools and a level warning" args={{ pools: true }} {template} />
<Story name="Both themes" args={{ both: true, width: 600 }} {template} />
<Story
	name="Inspired"
	args={{ inspired: true, tab: 'effects', both: true, width: 600 }}
	{template}
/>
<Story name="Inspired, narrow" args={{ inspired: true, width: 390 }} {template} />
<Story name="Actions: Fury Dice" args={{ tab: 'actions', actor: 'dicePool' }} {template} />
<Story
	name="Actions: your turn"
	args={{ tab: 'actions', actor: 'dicePool', combat: 'yourTurn' }}
	{template}
/>
<Story
	name="Actions: not your turn, narrow"
	args={{ tab: 'actions', actor: 'dicePool', combat: 'notYourTurn', width: 390 }}
	{template}
/>
<Story
	name="Actions: edit mode"
	args={{ tab: 'actions', actor: 'dicePool', editing: true }}
	{template}
/>
<Story
	name="Actions: Mage in combat"
	args={{ tab: 'actions', actor: 'mana', combat: 'yourTurn' }}
	{template}
/>
<Story name="Spells" args={{ tab: 'spells', actor: 'mana' }} {template} />
<Story
	name="Spells: not your turn, narrow"
	args={{ tab: 'spells', actor: 'mana', combat: 'notYourTurn', width: 390 }}
	{template}
/>
<Story name="Spells: edit mode" args={{ tab: 'spells', actor: 'mana', editing: true }} {template} />
<Story
	name="Actions and Spells: both themes"
	args={{ tab: 'actions', actor: 'dicePool', combat: 'yourTurn', both: true, width: 720 }}
	{template}
/>
<Story name="Features" args={{ tab: 'features', actor: 'features' }} {template} />
<Story
	name="Features: edit mode, narrow"
	args={{ tab: 'features', actor: 'features', editing: true, width: 390 }}
	{template}
/>
<Story name="Inventory" args={{ tab: 'inventory', actor: 'containers' }} {template} />
<Story
	name="Inventory: edit mode"
	args={{ tab: 'inventory', actor: 'containers', editing: true }}
	{template}
/>
<Story
	name="Inventory: narrow"
	args={{ tab: 'inventory', actor: 'containers', width: 390 }}
	{template}
/>
<Story name="Effects" args={{ tab: 'effects', actor: 'effects' }} {template} />
<Story name="Effects: narrow" args={{ tab: 'effects', actor: 'effects', width: 390 }} {template} />
<Story name="Bio" args={{ tab: 'bio', actor: 'containers' }} {template} />
<Story name="Settings" args={{ tab: 'settings' }} {template} />
<Story name="Settings: edit mode" args={{ tab: 'settings', editing: true }} {template} />
<Story
	name="Inventory and Effects: both themes"
	args={{ tab: 'inventory', actor: 'containers', both: true, width: 720 }}
	{template}
/>
