<script lang="ts">
	import { setContext, untrack } from 'svelte';

	import SpellGrantDisplay from '../../src/view/dialogs/components/characterCreator/SpellGrantDisplay.svelte';

	let {
		sourceFilter,
		spellGrants,
		spellIndex = new Map(),
		initialSelectedSchools,
		initialSelectedSpells,
		initialConfirmedSchools,
	}: {
		sourceFilter?: 'class' | 'background';
		spellGrants: import('../../src/view/dialogs/characterCreation/types.js').SpellGrantResult;
		spellIndex?: import('#utils/getSpells.js').SpellIndex | null;
		initialSelectedSchools: Map<string, string[]>;
		initialSelectedSpells: Map<string, string[]>;
		initialConfirmedSchools: Set<string>;
	} = $props();

	setContext('CHARACTER_CREATION_STAGES', { SPELLS: '0c' });
	setContext('dialog', { id: 'character-creation-dialog' });

	let selectedSchools = $state(new Map(untrack(() => initialSelectedSchools)));
	let selectedSpells = $state(new Map(untrack(() => initialSelectedSpells)));
	let confirmedSchools = $state(new Set(untrack(() => initialConfirmedSchools)));
</script>

<SpellGrantDisplay
	active={false}
	{spellGrants}
	{spellIndex}
	bind:selectedSchools
	bind:selectedSpells
	bind:confirmedSchools
	{sourceFilter}
/>

<div data-testid="confirmed-schools">{JSON.stringify([...confirmedSchools])}</div>
<div data-testid="selected-spells">{JSON.stringify([...selectedSpells.entries()])}</div>
<div data-testid="selected-schools">{JSON.stringify([...selectedSchools.entries()])}</div>
