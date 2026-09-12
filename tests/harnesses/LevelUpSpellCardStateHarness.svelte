<script lang="ts">
	import type { SpellCostActorLike } from '#types/spellCost.d.ts';
	import type { SpellIndexEntry } from '#utils/getSpells.js';

	import { createLevelUpSpellCardState } from '../../src/view/dialogs/components/levelUpHelper/LevelUpSpellCard.svelte.ts';

	let { spell, actor = {} }: { spell: SpellIndexEntry; actor?: SpellCostActorLike } = $props();

	const state = createLevelUpSpellCardState(
		() => spell,
		() => actor,
	);

	const loaded = $derived(state.displayData !== null);
	const costLabel = $derived(state.displayData?.costLabel ?? '');
</script>

<div data-testid="loaded">{String(loaded)}</div>
<div data-testid="cost-label">{costLabel}</div>
