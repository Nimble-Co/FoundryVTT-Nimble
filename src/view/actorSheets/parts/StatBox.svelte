<!--
@component
A secondary number that is always visible: armor, speed, and each other movement type (Burrow, Fly).
`box` is the NPC rail; `inline` is the character rail line under the HP plates. When a condition changes the number,
`warn` says the cause in words (for example "Slowed: halved"); the sheet does not change the number.
-->
<script lang="ts">
	import type { StatBoxProps } from '#types/components/actorSheets/StatBox.d.ts';

	let { icon, label, value, variant = 'box', warn, note, tooltip }: StatBoxProps = $props();
</script>

<span class="stat" class:inline={variant === 'inline'} data-tooltip={tooltip}>
	<span class="l"
		>{#if icon}<i class={icon}></i>{/if}
		{label}</span
	>
	<b>{value}</b>
	{#if warn}<span class="warn">{warn}</span>{/if}
	{#if note}<em class="note">{note}</em>{/if}
</span>

<style>
	.stat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 5px 8px;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;
		font-family: var(--nimble-primary-font);
	}
	.l {
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		font-size: 0.594rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--nimble-bronze);
	}
	b {
		font-size: 0.875rem;
		color: var(--nimble-ui-ink);
	}
	.inline {
		display: inline-flex;
		align-items: baseline;
		justify-content: flex-start;
		gap: 5px;
		padding: 0;
		border: 0;
		font-size: 0.729rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		white-space: nowrap;
		color: var(--nimble-ui-ink-dim);
	}
	.inline .l {
		/* icon, label and number share one baseline */
		display: contents;
		font-size: 0.729rem;
		letter-spacing: 0.05em;
		color: var(--nimble-ui-ink-dim);
	}
	.inline b {
		letter-spacing: 0;
		font-size: 0.937rem;
		font-weight: 600;
		line-height: 1;
	}
	.warn {
		font-size: 0.688rem;
		font-weight: 700;
		color: var(--nimble-ui-vital);
	}
	.inline .warn {
		font-size: 0.729rem;
		letter-spacing: 0;
	}
	.note {
		font-size: 0.729rem;
		font-style: normal;
		letter-spacing: 0;
		font-weight: 600;
		color: var(--nimble-ui-action);
	}
</style>
