<!--
@component
The Abilities tab: the ability groups in columns, as a stat block. A click on a card rolls or posts it; the arrow
shows or hides its text, which starts open; the pen opens its window. An attack sequence is a note above its actions.
Drag a card to reorder it in its group, or to put an action in or out of an attack sequence. On a touch screen
you drag only in edit mode.
-->
<script lang="ts">
	import type { MonsterAbilitiesTabProps } from '#types/components/actorSheets/MonsterAbilitiesTab.d.ts';
	import AbilityCard from '../../parts/AbilityCard.svelte';
	import AttackSequence from '../../parts/AttackSequence.svelte';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import { toggleClosedRow } from '../../shared/sheetUiState.ts';
	import { abilityDrag } from './abilityDrag.svelte.ts';

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
						{#if entry.kind === 'card'}
							<AbilityCard
								id="{uid}-{entry.id}"
								name={entry.name}
								img={entry.img}
								kind={entry.roll ? 'roll' : 'chat'}
								range={entry.range}
								uses={entry.uses}
								description={entry.description}
								descriptionHtml={entry.descriptionHtml}
								nested={entry.nested}
								bind:open={
									() => !ui.closedRows.includes(entry.id), () => toggleClosedRow(ui, entry.id)
								}
								onuse={() => perform(entry.use.intent)}
								onedit={() => perform(entry.edit.intent)}
							/>
						{:else if entry.kind === 'sequence'}
							<AttackSequence
								parts={entry.html === undefined ? [entry.text] : []}
								html={entry.html}
								name={entry.name}
								onedit={() => perform(entry.edit.intent)}
							/>
						{:else}
							<GroupHeading label={entry.name} plain />
						{/if}
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
		font-size: 0.929rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
