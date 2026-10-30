<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import AttackSequence from '#view/actorSheets/parts/AttackSequence.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rows/AttackSequence',
		component: AttackSequence,
		parameters: { width: '420px' },
	});
</script>

<Story
	name="With a random roll"
	args={{
		parts: [
			'After each hero’s turn, Move 6 then use ',
			['Eye Ray', 'b'],
			' (Range 10, ',
			['random ray', 'die'],
			') OR ',
			['Terrible Maw', 'b'],
			'.',
		],
	}}
/>
<Story
	name="One or the other"
	args={{ parts: [['Crush', 'b'], ' OR ', ['Bite/Swallow', 'b'], '.'] }}
/>
<Story
	name="From the sequence item, with a pen"
	args={{
		html: '<p>After each hero’s turn, choose one: <strong>Move &amp; Smack</strong> OR <strong>Grab &amp; Throw</strong>.</p>',
		name: 'Actions',
		onedit: fn(),
	}}
/>
