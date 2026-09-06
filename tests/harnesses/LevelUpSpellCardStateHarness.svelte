<script lang="ts">
	import type { SpellIndexEntry } from '#utils/getSpells.js';

	import { createLevelUpSpellCardState } from '../../src/view/dialogs/components/levelUpHelper/LevelUpSpellCard.svelte.ts';

	let { spell }: { spell: SpellIndexEntry } = $props();

	const state = createLevelUpSpellCardState(() => spell);

	const manaCost = $derived(state.displayData?.manaCost ?? null);
</script>

<div data-testid="mana-cost">{manaCost === null ? '' : String(manaCost)}</div>
