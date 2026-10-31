<!--
@component
The Abilities tab: the ability groups in columns, as a stat block. A click on a card rolls or posts it; the arrow
shows or hides its text, which starts open; the pen opens its window. An attack sequence is a note above its actions.
Drag a card to reorder it in its group, or to put an action in or out of an attack sequence. On a touch screen
you drag only in edit mode. Each entry, with its edit mode, is a MonsterAbilityEntry.
-->
<script lang="ts">
	import type { MonsterAbilitiesTabProps } from '#types/components/actorSheets/MonsterAbilitiesTab.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import { abilityDrag } from './abilityDrag.svelte.ts';
	import MonsterAbilityEntry from './MonsterAbilityEntry.svelte';

	let { view, ui, perform }: MonsterAbilitiesTabProps = $props();

	const uid = $props.id();
	const drag = abilityDrag(() => ({ view, ui, perform }));
</script>

{#if view.groups.length}
	<div class="columns">
		{#each view.groups as group (group.id)}
			<section class="group">
				<GroupHeading label={group.label} tone={group.tone} plain />
				{#each group.entries as entry (entry.id)}
					{@const line = drag.lineOf(entry)}
					<div
						class="entry"
						class:above={line === 'above'}
						class:below={line === 'below'}
						class:nest={line === 'nest'}
						class:nested={entry.kind === 'card' && entry.nested}
						data-row-id={entry.id}
						draggable={entry.drag ? 'true' : undefined}
						role="presentation"
						onpointerdown={drag.onpointerdown}
						ondragstart={(event) => drag.ondragstart(entry, event)}
						ondragover={(event) => drag.ondragover(entry, event)}
						ondragleave={(event) => drag.ondragleave(entry, event)}
						ondragend={drag.ondragend}
						ondrop={(event) => drag.ondrop(entry, event)}
					>
						<MonsterAbilityEntry {entry} {ui} {perform} {uid} />
					</div>
				{/each}
			</section>
		{/each}
	</div>
{:else}
	<p class="empty">{view.empty}</p>
{/if}

<style>
	.columns {
		column-width: 280px;
		column-gap: 18px;
	}
	.group {
		margin-bottom: 8px;
	}
	.entry {
		position: relative;
		break-inside: avoid;
		border-radius: 4px;
	}
	.above::before,
	.below::after,
	.nest::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		border-radius: 1px;
		background: var(--nimble-ui-own);
		pointer-events: none;
	}
	.above::before {
		top: -3px;
	}
	.below::after,
	.nest::after {
		bottom: 1px;
	}
	.nest::after {
		left: 14px;
	}
	.empty {
		margin: 8px 4px;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
