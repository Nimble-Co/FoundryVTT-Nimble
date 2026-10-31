<!--
@component
The frame of a roll window: the head with a tile and the name, the fields, then Cancel and the roll button.
The window header of Foundry lies over the head (`_roll-window.scss`), so you drag the window by the head.
Inside it you can use the classes `lb` (small heading), `fld` (a label with a field), `frm` (a formula) and `check` (a check box line).
-->
<script lang="ts">
	import type { RollWindowProps } from '#types/components/RollWindow.d.ts';
	import localize from '#utils/localize.js';
	import Button from '#view/actorSheets/parts/Button.svelte';
	import RowTile from '#view/actorSheets/parts/RowTile.svelte';

	let {
		title,
		img,
		icon,
		rollLabel,
		rollIcon = 'fa-solid fa-dice-d20',
		onroll,
		oncancel,
		children,
	}: RollWindowProps = $props();

	let root: HTMLDivElement | undefined = $state();

	$effect(() => {
		root?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
	});
</script>

<div bind:this={root} class="roll-window">
	<div class="head">
		<RowTile {img} {icon} />
		<b>{title}</b>
	</div>
	<div class="fields">
		{@render children()}
	</div>
	<div class="foot">
		<Button
			label={localize('NIMBLE.rollWindow.cancel')}
			tooltip={localize('NIMBLE.rollWindow.cancelHint')}
			onclick={oncancel}
		/>
		<Button variant="primary" icon={rollIcon} label={rollLabel} autofocus onclick={onroll} />
	</div>
</div>

<style>
	.roll-window {
		display: flex;
		flex-direction: column;
		gap: 11px;
		max-height: 80vh;
		padding: 12px;
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 32px;
		/* keeps the title clear of the close button */
		padding-right: 26px;
	}
	.head b {
		flex: 1;
		min-width: 0;
		font-size: 1.062rem;
		font-weight: 900;
		line-height: 1.1;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 11px;
		min-height: 0;
		overflow-y: auto;
	}
	.foot {
		flex: none;
		display: flex;
		gap: 6px;
	}
	.foot :global(.btn.secondary) {
		height: 34px;
		padding: 0 14px;
	}
	.foot :global(.btn.primary) {
		flex: 1;
	}
	.roll-window :global(.lb) {
		margin: 0 0 5px;
		border: 0;
		font-family: inherit;
		font-size: 0.688rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		line-height: 1.3;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
	}
	.roll-window :global(.fld) {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.roll-window :global(.fld input) {
		width: 100%;
		height: 28px;
		box-sizing: border-box;
		padding: 0 7px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 2px;
		background: var(--nimble-ui-well);
		box-shadow: none;
		font: 600 0.812rem var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.roll-window :global(.fld input::placeholder) {
		color: var(--nimble-ui-ink-muted);
		opacity: 1;
	}
	.roll-window :global(input:focus-visible) {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 1px;
	}
	.roll-window :global(.frm) {
		padding: 6px;
		border-radius: 4px;
		background: var(--nimble-ui-well);
		text-align: center;
		font: 600 0.812rem/1.2 var(--nimble-mono-font);
		color: var(--nimble-ui-ink);
	}
	.roll-window :global(.check) {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 28px;
		font-size: 0.812rem;
		font-weight: 600;
		color: var(--nimble-ui-ink);
		cursor: pointer;
	}
	.roll-window :global(.check input) {
		appearance: none;
		flex: none;
		position: relative;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 3px;
		background: var(--nimble-ui-well);
		box-shadow: none;
		cursor: pointer;
	}
	.roll-window :global(.check:hover input) {
		border-color: var(--nimble-ui-highlight);
	}
	.roll-window :global(.check input:focus-visible) {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 1px;
	}
	.roll-window :global(.check input[type='radio']) {
		border-radius: 50%;
	}
	.roll-window :global(.check input::before),
	.roll-window :global(.check input::after) {
		content: none;
	}
	.roll-window :global(.check input[type='radio']:checked::after) {
		content: '';
		position: absolute;
		top: 4px;
		left: 4px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--nimble-ui-highlight);
	}
	.roll-window :global(.check input[type='checkbox']:checked::after) {
		content: '';
		position: absolute;
		top: 2px;
		left: 5px;
		width: 6px;
		height: 10px;
		border: solid var(--nimble-ui-highlight);
		border-width: 0 2px 2px 0;
		border-radius: 0;
		transform: rotate(45deg);
	}
</style>
