<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import AbilityCard from '#view/actorSheets/parts/AbilityCard.svelte';
	import AttackSequence from '#view/actorSheets/parts/AttackSequence.svelte';
	import GroupHeading from '#view/actorSheets/parts/GroupHeading.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rows/AbilityCard',
		component: AbilityCard,
		args: { onuse: fn(), onedit: fn() },
		parameters: { width: '420px' },
	});
</script>

<Story
	name="Posts to chat"
	args={{
		name: 'Weakness',
		icon: 'fa-solid fa-heart-crack',
		description:
			'Taking more than 12 piercing or slashing damage: Dravok’s plans are FLAWED! (until the end of the next hero’s turn.)',
	}}
/>

<Story
	name="Rolls, with range"
	args={{
		name: 'Terrible Maw',
		kind: 'roll',
		icon: 'fa-solid fa-skull',
		range: 'Reach 1',
		description: '4d12+10 piercing.',
	}}
/>

<Story
	name="Uses per encounter"
	args={{
		name: 'BEEES!',
		kind: 'roll',
		icon: 'fa-solid fa-bolt',
		uses: { left: 1, max: 1, per: 'encounter' },
		description: 'Deal 5d4 damage (doesn’t miss). Half as much to ALL adjacent creatures.',
	}}
/>

<Story
	name="No uses left"
	args={{
		name: 'HIDDEN NET!',
		icon: 'fa-solid fa-ban',
		state: 'out',
		uses: { left: 0, max: 1, per: 'encounter' },
		description: 'Restrained (escape DC 10).',
	}}
/>

<Story
	name="Text closed"
	args={{
		name: 'Shoot',
		kind: 'roll',
		icon: 'fa-solid fa-crosshairs',
		range: 'Range 8',
		open: false,
		description: '1d6+2.',
	}}
/>

<Story
	name="Phone"
	args={{
		name: 'Stab',
		kind: 'roll',
		icon: 'fa-solid fa-hand-fist',
		touch: true,
		description: '1d4 (follows minion rules).',
	}}
	parameters={{ width: '390px' }}
/>

<Story name="A stat block" asChild>
	<GroupHeading label="Features" plain />
	<AbilityCard
		name="My plans, flawless!"
		icon="fa-solid fa-scroll"
		description="Dravok makes all saves with +1 Advantage, attacks against him have Disadvantage."
		onuse={fn()}
		onedit={fn()}
	/>
	<GroupHeading label="Actions" plain />
	<AttackSequence
		parts={[
			'After each hero’s turn, Move 6 then use ',
			['Eye Ray', 'b'],
			' (Range 10, ',
			['random ray', 'die'],
			') OR ',
			['Terrible Maw', 'b'],
			'.',
		]}
	/>
	<AbilityCard
		nested
		kind="roll"
		name="1. Warping Ray"
		icon="fa-solid fa-wand-sparkles"
		description="3d6. On hit: Dazed, exchange places with target."
		onuse={fn()}
		onedit={fn()}
	/>
	<AbilityCard
		nested
		name="2. Petrification Ray"
		icon="fa-solid fa-mountain"
		description="Permanently Dazed. Healing ends. (3 stacks, Petrified)."
		onuse={fn()}
		onedit={fn()}
	/>
	<AbilityCard
		kind="roll"
		name="Terrible Maw"
		icon="fa-solid fa-skull"
		range="Reach 1"
		description="4d12+10 piercing."
		onuse={fn()}
		onedit={fn()}
	/>
	<GroupHeading label="Bloodied" plain tone="bloodied" />
	<AbilityCard
		name="Eyes Everywhere"
		icon="fa-solid fa-eye-slash"
		description="At 160 HP, Dravok fires two Eye Rays each turn instead of one."
		onuse={fn()}
		onedit={fn()}
	/>
</Story>
