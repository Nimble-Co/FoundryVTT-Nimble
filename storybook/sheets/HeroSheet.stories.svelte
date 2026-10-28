<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { HeroSheetContext } from '#view/actorSheets/hero/heroSource.ts';
	import localize from '#utils/localize.js';
	import {
		blankHero,
		heroContext,
		heroTurn,
	} from '../../tests/fixtures/actorSheets/heroFixtures.ts';
	import HeroSheetStory from './HeroSheetStory.svelte';

	interface Args {
		width: number;
		height: number;
		editing: boolean;
		combat: 'out' | 'yourTurn' | 'notYourTurn';
		pools: boolean;
		/** both themes side by side */
		both: boolean;
	}

	const { Story } = defineMeta({
		title: 'Sheets/Character sheet',
		args: { width: 720, height: 850, editing: false, combat: 'out', pools: false, both: false },
		argTypes: {
			width: { control: { type: 'select' }, options: [390, 460, 600, 720, 960] },
			height: { control: { type: 'select' }, options: [650, 850] },
			combat: { control: { type: 'inline-radio' }, options: ['out', 'yourTurn', 'notYourTurn'] },
		},
		parameters: { layout: 'fullscreen' },
	});

	const perform = fn().mockName('perform');

	function context(args: Args): HeroSheetContext {
		return heroContext({
			localize: (key) => localize(key),
			format: (key, data) => localize(key, data),
			combat:
				args.combat === 'out'
					? null
					: heroTurn({ isTurn: args.combat === 'yourTurn', actions: { pendingDelta: 1 } }),
			missingLevelSelections: args.pools ? [3] : [],
			dicePools: args.pools
				? [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [5, 2] }]
				: [],
			chargePools: args.pools
				? [
						{
							id: 'combatDice',
							label: 'Combat Dice',
							current: 2,
							max: 3,
							dieSize: 'd8',
							hidden: false,
							showAsResource: true,
						},
					]
				: [],
		});
	}

	const hero = blankHero({
		img: 'assets/classImages/berserker.webp',
		system: { attributes: { hp: { value: 9 }, wounds: { value: 1 } } },
	});
	const caster = blankHero({
		img: 'assets/classImages/berserker.webp',
		system: { resources: { mana: { current: 3, max: 5 } } },
	});
</script>

{#snippet sheet(args: Args, theme?: string)}
	<HeroSheetStory
		source={() => ({ actor: args.pools ? caster : hero, context: context(args) })}
		{perform}
		width={args.width}
		height={args.height}
		editing={args.editing}
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
