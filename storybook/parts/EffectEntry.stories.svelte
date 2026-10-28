<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import EffectEntry from '#view/actorSheets/parts/EffectEntry.svelte';
	import GroupHeading from '#view/actorSheets/parts/GroupHeading.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Sheet/EffectEntry',
		component: EffectEntry,
		args: { onend: fn() },
		parameters: { width: '440px' },
	});
</script>

<Story
	name="Your own effect"
	args={{
		own: true,
		open: true,
		name: 'Rage',
		source: 'Berserker',
		duration: 'Until it ends',
		icon: 'fa-solid fa-fire',
		text: 'Add your Fury Dice to every STR attack. It ends if you do not attack or take damage on your turn.',
	}}
/>
<Story
	name="A condition"
	args={{
		name: 'Dazed',
		source: 'Dravok, Warping Ray',
		duration: '1 round',
		icon: 'fa-solid fa-star',
		text: 'You lose 1 action.',
	}}
/>
<Story
	name="A passive effect"
	args={{
		name: 'Stout',
		source: 'Ancestry',
		icon: 'fa-solid fa-shield',
		text: '+2 max Hit Dice, +1 Hit Die size, −1 speed.',
	}}
/>
<Story name="The Effects tab" asChild>
	<GroupHeading label="Active effects" note="1" />
	<EffectEntry
		own
		name="Rage"
		source="Berserker"
		duration="Until it ends"
		icon="fa-solid fa-fire"
		text="Add your Fury Dice to every STR attack."
		onend={fn()}
	/>
	<GroupHeading label="Conditions on you" note="1" />
	<EffectEntry
		name="Dazed"
		source="Dravok, Warping Ray"
		duration="1 round"
		icon="fa-solid fa-star"
		text="You lose 1 action."
	/>
	<GroupHeading label="Passive effects" />
	<EffectEntry
		name="Stout"
		source="Ancestry"
		icon="fa-solid fa-shield"
		text="+2 max Hit Dice, +1 Hit Die size, −1 speed."
	/>
</Story>
