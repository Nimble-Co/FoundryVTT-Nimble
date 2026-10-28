<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import ExpandAllButton from '#view/actorSheets/parts/ExpandAllButton.svelte';
	import GroupHeading from '#view/actorSheets/parts/GroupHeading.svelte';
	import Row from '#view/actorSheets/parts/Row.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rows/Row',
		component: Row,
		args: { onuse: fn(), onedit: fn() },
		parameters: { width: '500px' },
	});
</script>

<Story
	name="Feature, open"
	args={{
		id: 'rage',
		name: 'Rage',
		icon: 'fa-solid fa-fire',
		open: true,
		summary: 'Roll a Fury Die and set it aside.',
		cost: { uses: [{ left: 1, max: 1, per: 'turn' }], actions: 1 },
		description:
			'Roll a Fury Die and set it aside. Add it to every STR attack. Max KEY Fury Dice; lost when Rage ends.',
		facts: [
			['Cost', '1 action'],
			['Uses', '1 of 1 left. It comes back each turn.'],
			['From', 'Class - Berserker, level 1'],
		],
	}}
/>

<Story
	name="Pool cost, free"
	args={{
		name: 'Bloodlust',
		icon: 'fa-solid fa-droplet',
		summary: 'Expend 1+ Fury Dice on your turn: move DEX (2) spaces.',
		cost: { pool: { kind: 'dice', icon: 'fa-solid fa-dice-d6', amount: '1-3' }, free: true },
	}}
/>

<Story
	name="Mana cost"
	args={{
		name: 'Fireball',
		icon: 'fa-solid fa-fire',
		summary: '6d6 fire damage in a Reach 2 area.',
		cost: { pool: { kind: 'mana', icon: 'fa-solid fa-droplet', amount: 3 }, actions: 2 },
	}}
/>

<Story
	name="Item art"
	args={{
		name: 'Mangle Maul',
		img: 'assets/magicItems/MangleMaul.webp',
		equipped: true,
		onequip: fn(),
		summary: '2d6+3. Two-handed.',
		cost: { actions: 1 },
	}}
/>

<Story
	name="Weapon, not equipped"
	args={{
		name: 'Throwing Axe',
		icon: 'fa-solid fa-hand-fist',
		equipped: false,
		onequip: fn(),
		summary: '1d6+3, Range 4. Thrown.',
		cost: { text: 'x2', actions: 1 },
	}}
/>

<Story
	name="Active"
	args={{
		name: 'Rage',
		icon: 'fa-solid fa-fire',
		tag: 'On',
		tagOn: true,
		state: 'active',
		summary: 'Fury Dice: 5, 3.',
		cost: { uses: [{ left: 0, max: 1, per: 'turn' }], actions: 1, actionsSpent: 1 },
	}}
/>

<Story
	name="Just used"
	args={{
		name: 'Throwing Axe',
		icon: 'fa-solid fa-hand-fist',
		state: 'just',
		summary: '1d6+3, Range 4. Thrown.',
		summaryTone: 'act',
		cost: { text: 'x2', actions: 1 },
	}}
/>

<Story
	name="No uses left"
	args={{
		name: 'Healing Potion',
		icon: 'fa-solid fa-flask',
		state: 'out',
		summary: '2d6+2. Drink it to heal.',
		cost: { text: 'x0' },
	}}
/>

<Story
	name="No window"
	args={{
		name: 'Interpose',
		icon: 'fa-solid fa-shield-halved',
		hasWindow: false,
		summary: 'Reaction: take a hit for an adjacent ally.',
	}}
/>

<Story
	name="Phone"
	args={{
		name: 'Greataxe',
		icon: 'fa-solid fa-hand-fist',
		touch: true,
		summary: '2d6+3. Two-handed.',
		cost: { actions: 1 },
	}}
	parameters={{ width: '390px' }}
/>

<Story name="A tab of rows" asChild>
	<GroupHeading label="Class - Berserker"><ExpandAllButton /></GroupHeading>
	<Row
		name="Rage"
		icon="fa-solid fa-fire"
		summary="Roll a Fury Die and set it aside."
		cost={{ uses: [{ left: 1, max: 1, per: 'turn' }], actions: 1 }}
		description="Roll a Fury Die and set it aside."
		onuse={fn()}
		onedit={fn()}
	/>
	<Row
		name="Bloodlust"
		icon="fa-solid fa-droplet"
		summary="Expend 1+ Fury Dice on your turn."
		cost={{ pool: { kind: 'dice', icon: 'fa-solid fa-dice-d6', amount: '1-3' }, free: true }}
		onuse={fn()}
		onedit={fn()}
	/>
	<Row
		name="Intensifying Fury"
		icon="fa-solid fa-dice"
		summary="Changes Rage. Each time you take damage while raging, add a Fury Die."
		onedit={fn()}
	/>
	<div style="height: 18px"></div>
	<GroupHeading label="Ancestry" />
	<Row
		name="Stout"
		icon="fa-solid fa-mountain"
		summary="+2 max Hit Dice, +1 Hit Die size, −1 speed."
		onedit={fn()}
	/>
</Story>
