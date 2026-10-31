<!--
@component
A line of a Settings tab: the label with one short help line under it, and the control at the right.
The control is a `.value` (a number or text with no well; a dashed line shows that you can type) or an
`input[role='switch']`. Give the control `aria-describedby="{id}-hint"` when there is a hint.
-->
<script lang="ts">
	import type { SettingLineProps } from '#types/components/actorSheets/SettingLine.d.ts';

	let { label, hint, id, children }: SettingLineProps = $props();
</script>

<div class="line">
	<div class="text">
		{#if id}<label for={id}>{label}</label>{:else}<span>{label}</span>{/if}
		{#if hint}<small id={id ? `${id}-hint` : undefined}>{hint}</small>{/if}
	</div>
	{@render children()}
</div>

<style>
	.line {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 34px;
		padding: 4px;
	}
	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink);
	}
	small {
		font-size: 0.703rem;
		line-height: 1.3;
		color: var(--nimble-ui-ink-muted);
	}
	.line :global(.value) {
		all: unset;
		box-sizing: border-box;
		flex: none;
		width: 64px;
		height: 26px;
		padding: 0 3px;
		border-bottom: 1px dashed transparent;
		font-size: 0.875rem;
		font-weight: 700;
		text-align: right;
		color: var(--nimble-ui-ink);
		appearance: textfield;
	}
	.line :global(.value.wide) {
		width: 120px;
	}
	.line :global(span.value) {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		width: auto;
	}
	.line :global(.value::-webkit-inner-spin-button) {
		display: none;
	}
	.line :global(input.value:enabled) {
		border-bottom-color: var(--nimble-ui-ring);
		cursor: text;
	}
	.line :global(input.value:focus) {
		border-bottom-style: solid;
		border-color: var(--nimble-ui-highlight);
	}
	.line :global(input[role='switch']) {
		position: relative;
		flex: none;
		width: 30px;
		height: 16px;
		margin: 0 3px 0 0;
		border: 0;
		border-radius: 8px;
		background: var(--nimble-ui-well);
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
		appearance: none;
		cursor: pointer;
	}
	.line :global(input[role='switch']::before) {
		display: none;
	}
	.line :global(input[role='switch']::after) {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--nimble-ui-ink-dim);
		transition:
			transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1),
			background 0.16s;
	}
	.line :global(input[role='switch']:checked) {
		background: var(--nimble-crimson);
		box-shadow: none;
	}
	.line :global(input[role='switch']:checked::after) {
		transform: translateX(14px);
		background: var(--nimble-ui-fill-ink);
	}
	.line :global(input[role='switch']:disabled) {
		cursor: default;
	}
	.line :global(input[role='switch']:focus-visible) {
		outline: 2px solid var(--nimble-ui-highlight);
		outline-offset: 2px;
	}
</style>
