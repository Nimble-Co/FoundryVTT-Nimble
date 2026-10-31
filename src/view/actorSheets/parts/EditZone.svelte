<!--
@component
Edit mode: a quiet dashed outline over a part that you configure. Point at it or focus it and a crimson tag says what opens.
The parent must be positioned (`position: relative`). Every outline is 5 px from its content, with an 8 px radius.
-->
<script lang="ts">
	import type { EditZoneProps } from '#types/components/actorSheets/EditZone.d.ts';

	let { short, label, inline = false, row = false, onclick }: EditZoneProps = $props();
</script>

<button
	type="button"
	class="nimble-u-reset-button zone"
	class:inline
	class:row
	aria-label={label}
	data-tooltip={label}
	{onclick}
>
	<span class="tags"><span class="tag"><i class="fa-solid fa-gear"></i>{short}</span></span>
</button>

<style>
	.zone {
		position: absolute;
		inset: -5px;
		z-index: 2;
		display: block;
		border: 1px dashed var(--nimble-ui-edge);
		border-radius: 8px;
		background: transparent;
		transition:
			background 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			border-color 0.14s;
	}
	.zone:hover,
	.zone:focus-visible {
		border-style: solid;
		border-color: var(--nimble-ui-own);
		background: var(--nimble-ui-own-background);
		outline: none;
	}
	.row {
		inset: 0 -5px;
	}
	.tags {
		position: absolute;
		top: -10px;
		right: 6px;
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.inline .tags {
		top: 50%;
		right: 4px;
		transform: translateY(-50%);
	}
	.zone:hover .tags,
	.zone:focus-visible .tags {
		opacity: 1;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 20px;
		padding: 0 7px;
		border-radius: 3px;
		background: var(--nimble-crimson);
		font: 700 0.718rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-fill-ink);
		white-space: nowrap;
	}
	.tag i {
		font-size: 0.563rem;
	}
</style>
