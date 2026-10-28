<!--
@component
Two or three ways to show one list: one is on. It sits in the bar of a list tab, next to Expand all, and has its height (28 px).
The Spells tab uses it: "By tier" and "By school". The choice changes only the groups, not the rows.
-->
<script lang="ts">
	import type { ViewOption } from './types.ts';

	interface Props {
		options: ViewOption[];
		/** the value of the option that is on */
		value?: string;
		/** what the switch changes, for a screen reader: "Group the spells" */
		label: string;
		onchange?: (value: string) => void;
	}

	let { options, value = $bindable(), label, onchange }: Props = $props();
	const on = $derived(value ?? options[0]?.value);

	function pick(v: string) {
		if (v === on) return;
		value = v;
		onchange?.(v);
	}
</script>

<div class="sw" role="group" aria-label={label}>
	{#each options as o (o.value)}
		<button
			type="button"
			class="nimble-u-reset-button"
			aria-pressed={o.value === on}
			onclick={() => pick(o.value)}>{o.label}</button
		>
	{/each}
</div>

<style>
	.sw {
		display: inline-flex;
		flex: none;
		gap: 2px;
		height: 28px;
		padding: 2px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
	}
	button {
		display: flex;
		align-items: center;
		padding: 0 8px;
		border-radius: 2px;
		font-size: 0.857rem;
		font-weight: 700;
		color: var(--nimble-ui-ink-muted);
		white-space: nowrap;
		transition:
			color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	button:hover {
		color: var(--nimble-ui-ink);
		background: var(--nimble-ui-hover);
	}
	button[aria-pressed='true'] {
		color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
		box-shadow: inset 0 0 0 1px var(--nimble-ui-highlight);
	}
</style>
