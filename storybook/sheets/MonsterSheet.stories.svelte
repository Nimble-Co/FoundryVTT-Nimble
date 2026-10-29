<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import localize from '#utils/localize.js';
	import type { MonsterTabId } from '#view/actorSheets/monster/monsterFrame.ts';
	import type {
		MonsterActorLike,
		MonsterSheetContext,
	} from '#view/actorSheets/monster/monsterSource.ts';
	import {
		effectsMonster,
		effectsMonsterContext,
		goblin,
		minion,
		monsterContext,
		soloMonster,
	} from '../../tests/fixtures/actorSheets/monsterFixtures.ts';
	import MonsterSheetStory from './MonsterSheetStory.svelte';

	interface Args {
		width: number;
		height: number;
		/** the tab at the start */
		tab: MonsterTabId;
		/** monster: the Goblin; solo: Pudge the Blunderer; minion: the Kobold Minion; effects: the Goblin with Bless and Dazed */
		actor: 'monster' | 'solo' | 'minion' | 'effects';
		/** start Bloodied */
		bloodied: boolean;
		/** both themes side by side */
		both: boolean;
	}

	const { Story } = defineMeta({
		title: 'Sheets/NPC sheet',
		args: {
			width: 660,
			height: 650,
			tab: 'abilities',
			actor: 'solo',
			bloodied: false,
			both: false,
		},
		argTypes: {
			width: { control: { type: 'select' }, options: [390, 460, 660, 900] },
			height: { control: { type: 'select' }, options: [520, 650, 850] },
			tab: { control: { type: 'select' }, options: ['abilities', 'effects', 'notes', 'settings'] },
			actor: { control: { type: 'select' }, options: ['monster', 'solo', 'minion', 'effects'] },
		},
		parameters: { layout: 'fullscreen' },
	});

	const perform = fn().mockName('perform');

	function context(args: Args): MonsterSheetContext {
		const words = {
			localize: (key: string) => localize(key),
			format: (key: string, data: Record<string, string>) => localize(key, data),
			labels: {
				...monsterContext().labels,
				sizes: { small: 'Small', medium: 'Medium', large: 'Large' },
			},
		};
		return args.actor === 'effects' ? effectsMonsterContext(words) : monsterContext(words);
	}

	function actorOf(args: Args): MonsterActorLike {
		const hp = (max: number) => ({
			value: args.bloodied ? Math.floor(max * 0.43) : max,
			max,
			temp: 0,
		});
		const art = { img: 'assets/monsterImages/Goblin.webp' };
		if (args.actor === 'solo') return soloMonster({ system: { attributes: { hp: hp(75) } } });
		if (args.actor === 'minion') return minion({ img: 'assets/monsterImages/Kobold.webp' });
		if (args.actor === 'effects') return effectsMonster(art);
		return goblin({ ...art, system: { attributes: { hp: hp(15) } } });
	}
</script>

{#snippet sheet(args: Args, theme?: string)}
	<MonsterSheetStory
		source={() => ({ actor: actorOf(args), context: context(args) })}
		{perform}
		width={args.width}
		height={args.height}
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

<Story name="Solo monster" {template} />
<Story name="Solo monster: narrow" args={{ width: 390 }} {template} />
<Story
	name="Solo monster: Bloodied, both themes"
	args={{ bloodied: true, both: true }}
	{template}
/>
<Story name="Monster" args={{ actor: 'monster' }} {template} />
<Story name="Monster: narrow" args={{ actor: 'monster', width: 390 }} {template} />
<Story name="Monster: both themes" args={{ actor: 'monster', both: true }} {template} />
<Story
	name="Monster: narrow, both themes"
	args={{ actor: 'monster', width: 390, both: true }}
	{template}
/>
<Story name="Minion" args={{ actor: 'minion' }} {template} />
<Story name="Minion: narrow" args={{ actor: 'minion', width: 390 }} {template} />
<Story name="Minion: both themes" args={{ actor: 'minion', both: true }} {template} />
<Story
	name="Minion: narrow, both themes"
	args={{ actor: 'minion', width: 390, both: true }}
	{template}
/>
<Story name="Solo monster: narrow, both themes" args={{ width: 390, both: true }} {template} />
<Story name="Effects" args={{ actor: 'effects', tab: 'effects' }} {template} />
<Story name="Notes" args={{ actor: 'monster', tab: 'notes' }} {template} />
<Story name="Settings" args={{ actor: 'monster', tab: 'settings' }} {template} />
