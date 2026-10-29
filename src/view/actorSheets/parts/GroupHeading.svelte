<!--
@component
The heading over a group of rows: CLASS, WEAPONS, ACTIVE EFFECTS. A line goes under it, the full width of the group (see Lines).
A short note (a count, "2 on") goes after the label, and buttons (Expand all, Create) go at the end.
`noteTone="muted"` makes the note quiet, and `now` marks the group that applies now (the reactions when it is not your turn).
`plain` is the NPC column label: bronze, no line, and `tone` for the Bloodied and Last Stand groups. It never ends a column.
In edit mode, `editing` leaves 8 px under a heading over rows, and `buttonGap="md"` spreads the configure buttons.
`blocks` is a heading over blocks (chips, a paragraph), not rows, as on the NPC Effects and Notes tabs: less space above, more below.
`line="none"` is a heading with no line (the NPC Effects and Notes tabs).
-->
<script lang="ts">
	import type { GroupHeadingProps } from '#types/components/actorSheets/GroupHeading.d.ts';

	let {
		label,
		note,
		noteTone = 'highlight',
		now = false,
		flush = false,
		tone,
		line = 'under',
		plain = false,
		blocks = false,
		editing = false,
		buttonGap = 'sm',
		children,
	}: GroupHeadingProps = $props();
</script>

<div
	class="grp {tone ?? ''}"
	class:under={line === 'under' && !plain}
	class:plain
	class:blocks
	class:editing
	class:now
	class:flush
>
	<span role="heading" aria-level="3">{label}</span>{#if note !== undefined}<small class={noteTone}
			>{note}</small
		>{/if}
	{#if children}<span class="act" class:md={buttonGap === 'md'}>{@render children()}</span>{/if}
</div>

<style>
	.grp {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px 0 2px;
		font-size: 0.786rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
	}
	.under {
		padding-bottom: 5px;
		border-bottom: 1px solid var(--nimble-ui-soft);
		margin-bottom: 4px;
	}
	.flush {
		margin-top: 0;
	}
	.editing {
		margin-bottom: 8px;
	}
	.blocks {
		margin: 4px 0 6px;
	}
	.plain {
		break-after: avoid;
		color: var(--nimble-bronze);
		margin: 6px 0 2px;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.bloodied {
		color: var(--nimble-roll-failure-color);
	}
	.lastStand {
		color: var(--nimble-ability-will-color);
	}
	small {
		font-size: 0.786rem;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: none;
		color: var(--nimble-ui-highlight);
	}
	small.muted {
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.now,
	.now small {
		color: var(--nimble-ui-highlight);
	}
	.now small {
		font-weight: 700;
	}
	.act {
		margin-left: auto;
		display: flex;
		gap: 4px;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: none;
	}
	.act.md {
		gap: 8px;
	}
</style>
