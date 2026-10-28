<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Button from '#view/actorSheets/parts/Button.svelte';
	import ExpandAllButton from '#view/actorSheets/parts/ExpandAllButton.svelte';
	import GroupHeading from '#view/actorSheets/parts/GroupHeading.svelte';

	const { Story } = defineMeta({
		title: 'Parts/Rows/GroupHeading',
		component: GroupHeading,
		parameters: { width: '500px' },
	});
</script>

<Story name="Group label" args={{ label: 'Class - Berserker' }} />
<Story name="With a note" args={{ label: 'Conditions', note: '2 on' }} />
<Story name="Muted note" args={{ label: 'Reactions', note: 'Not your turn', noteTone: 'muted' }} />
<Story
	name="Applies now"
	args={{ label: 'Reactions', note: 'Now', noteTone: 'muted', now: true }}
/>
<Story name="With a button" args={{ label: 'Weapons' }}>
	{#snippet template(args)}
		<GroupHeading {...args}><ExpandAllButton /></GroupHeading>
	{/snippet}
</Story>
<Story name="NPC column label" args={{ label: 'Actions', plain: true }} />
<Story name="NPC Bloodied label" args={{ label: 'Bloodied', plain: true, tone: 'bloodied' }} />
<Story name="NPC Last Stand label" args={{ label: 'Last Stand', plain: true, tone: 'lastStand' }} />
<Story
	name="Over blocks, no line"
	args={{ label: 'Conditions', note: '1 on', blocks: true, line: 'none' }}
/>
<Story name="Edit mode" args={{ label: 'Abilities and saves', editing: true, buttonGap: 'md' }}>
	{#snippet template(args)}
		<GroupHeading {...args}>
			<Button label="Stats" icon="fa-solid fa-gear" />
			<Button label="Saves" icon="fa-solid fa-gear" />
		</GroupHeading>
	{/snippet}
</Story>
