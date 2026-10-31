<!--
@component
The Edit switch of a sheet: a track with the label, a pen icon in the narrow header (`compact`),
or a menu row under the NPC rail tabs (`menu`).
It is pressed while the sheet is in edit mode.
-->
<script lang="ts">
	import type { EditSwitchProps } from '#types/components/actorSheets/EditSwitch.d.ts';

	let {
		editing,
		label,
		startHint,
		stopHint,
		compact = false,
		menu = false,
		onclick,
	}: EditSwitchProps = $props();

	const hint = $derived(editing ? stopHint : startHint);
</script>

<button
	type="button"
	class="nimble-u-reset-button edit"
	class:compact
	class:menu
	aria-pressed={editing}
	aria-label={compact ? hint : undefined}
	data-tooltip={hint}
	{onclick}
>
	{#if compact}
		<i class="fa-solid fa-pen"></i>
	{:else if menu}
		<i class="fa-solid fa-pen"></i><span class="label">{label}</span><span class="track"></span>
	{:else}
		<span class="track"></span>{label}
	{/if}
</button>

<style>
	.edit {
		flex: none;
		display: flex;
		align-items: center;
		gap: 7px;
		height: 30px;
		padding: 0 10px 0 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.compact {
		width: 28px;
		height: 28px;
		padding: 0;
		justify-content: center;
	}
	.menu {
		width: 100%;
		height: auto;
		min-height: 26px;
		gap: 8px;
		padding: 4px 7px;
		border: none;
		color: var(--nimble-bronze);
	}
	.menu i {
		width: 14px;
		font-size: 0.75rem;
		text-align: center;
	}
	.menu .label {
		flex: 1;
		text-align: left;
	}
	.edit:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.menu:hover,
	.menu[aria-pressed='true'] {
		color: var(--nimble-ui-ink);
	}
	.edit[aria-pressed='true'] {
		border-color: var(--nimble-crimson);
		background: var(--nimble-ui-own-background);
	}
	.compact[aria-pressed='true'] {
		background: var(--nimble-crimson);
		color: var(--nimble-ui-fill-ink);
	}
	.track {
		position: relative;
		flex: none;
		width: 26px;
		height: 14px;
		border-radius: 7px;
		background: var(--nimble-ui-well);
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
	}
	.track::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--nimble-ui-ink-dim);
		transition:
			transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1),
			background 0.16s;
	}
	.edit[aria-pressed='true'] .track {
		background: var(--nimble-crimson);
		box-shadow: none;
	}
	.edit[aria-pressed='true'] .track::after {
		transform: translateX(12px);
		background: var(--nimble-ui-fill-ink);
	}
</style>
