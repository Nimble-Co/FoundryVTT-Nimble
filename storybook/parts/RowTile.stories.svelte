<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RowTile from '#view/actorSheets/parts/RowTile.svelte';

	const { Story } = defineMeta({ title: 'Parts/Rows/RowTile', component: RowTile });
</script>

<Story name="Document art" args={{ img: 'assets/magicItems/PheonixHelm.webp' }} />
<Story
	name="Document art, NPC size"
	args={{ img: 'assets/magicItems/GemOfEscape.webp', size: 'sm' }}
/>
<Story name="Font Awesome" args={{ icon: 'fa-solid fa-hand-fist' }} />
<Story name="Window head" args={{ icon: 'fa-solid fa-hand-fist', size: 'win' }} />
