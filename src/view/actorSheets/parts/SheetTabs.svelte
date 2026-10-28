<!--
@component
The tabs of a sheet, in three layouts:

- `top`: the character sheet tab bar. Eight fixed slots that never move: Core, Actions, Features, Inventory, Spells, Effects, Bio, Settings.
- `rail`: the NPC list at the bottom of the rail (four tabs).
- `strip`: the phone strip under the header.

The top layout fits the width of a tab slot (`fit`): `inline` (icon beside the label), `stacked`
(icon over the label) or `icon` (the label hides; it stays as the tooltip).

A tab can show a count badge. The Effects tab counts the conditions and active effects that are on you now; passive effects are not in the count.
The rail and the strip sit on the dark chrome (`nimble-chrome`).
-->
<script lang="ts">
	import localize from '#utils/localize.js';
	import type { SheetTab } from './types.ts';

	interface Props {
		tabs: SheetTab[];
		/** the id of the selected tab */
		value?: string;
		onchange?: (id: string) => void;
		layout?: 'top' | 'rail' | 'strip';
		/** top: the layout for the width of a slot */
		fit?: 'inline' | 'stacked' | 'icon';
		/** default "Sheet tabs" */
		label?: string;
	}

	let { tabs, value = $bindable(), onchange, layout = 'top', fit, label }: Props = $props();

	function pick(id: string) {
		value = id;
		onchange?.(id);
	}

	const tooltipOf = (t: SheetTab) =>
		t.badge && t.badgeTitle
			? localize('NIMBLE.actorSheet.parts.sheetTabs.withBadge', {
					label: t.label,
					badge: t.badgeTitle,
				})
			: t.label;
</script>

<div
	class="tabs {layout} {fit ? `fit fit-${fit}` : ''}"
	role="tablist"
	aria-label={label ?? localize('NIMBLE.actorSheet.parts.sheetTabs.label')}
>
	{#each tabs as t (t.id)}
		<button
			type="button"
			role="tab"
			class="nimble-u-reset-button t"
			aria-selected={t.id === value}
			aria-label={fit === 'icon' ? tooltipOf(t) : undefined}
			data-tooltip={tooltipOf(t)}
			onclick={() => pick(t.id)}
		>
			<i class={t.icon}></i><span class="tl">{t.label}</span>
			{#if t.badge}<span class="bd">{t.badge}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		font-family: var(--nimble-primary-font);
	}
	.t {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		height: 44px;
		font-size: 0.833rem;
		font-weight: 600;
		line-height: 1;
		color: var(--nimble-ui-ink-dim);
	}
	.t i {
		font-size: 0.929rem;
	}
	.t:hover {
		color: var(--nimble-ui-ink);
	}
	.top .t[aria-selected='true'] {
		color: var(--nimble-ui-highlight);
		box-shadow: inset 0 -2px 0 var(--nimble-ui-highlight);
	}
	.bd {
		min-width: 8px;
		padding: 0 5px;
		border-radius: 8px;
		background: var(--nimble-crimson);
		font: 800 0.786rem/16px var(--nimble-primary-font);
		color: #fff;
		text-align: center;
	}
	.top .bd {
		position: absolute;
		top: 2px;
		right: 6px;
	}
	.fit .t {
		font-size: 0.929rem;
	}
	.fit .t i {
		font-size: 0.857rem;
	}
	.fit .t:hover {
		color: var(--nimble-ui-ink-dim);
	}
	.fit .t[aria-selected='true'] {
		color: var(--nimble-ui-highlight);
	}
	.fit-inline .t {
		flex-direction: row;
		gap: 6px;
		height: 38px;
	}
	.fit-stacked .t {
		font-size: 0.786rem;
	}
	.fit-icon .t {
		flex-direction: row;
		height: 40px;
	}
	.fit-icon .t i {
		font-size: 1rem;
	}
	.fit-icon .tl {
		display: none;
	}
	.fit .bd {
		right: 0;
		padding: 0 4px;
		letter-spacing: 0;
		text-align: left;
	}
	.rail {
		flex-direction: column;
		gap: 1px;
	}
	.rail .t {
		flex: none;
		flex-direction: row;
		justify-content: flex-start;
		gap: 8px;
		height: auto;
		min-height: 26px;
		padding: 4px 7px;
		border-radius: 4px;
		font-size: 0.857rem;
		color: var(--nimble-bronze);
	}
	.rail .t i {
		width: 14px;
		font-size: 0.857rem;
	}
	.rail .bd {
		margin-left: auto;
	}
	.strip {
		gap: 2px;
		padding: 3px 6px;
	}
	.strip .t {
		flex-direction: row;
		gap: 5px;
		height: 40px;
		line-height: 1.25;
		border-radius: 4px;
		color: var(--nimble-bronze);
	}
	.strip .t i {
		font-size: 0.714rem;
	}
	.rail .t:hover,
	.strip .t:hover {
		color: var(--nimble-ui-ink);
	}
	.rail .t[aria-selected='true'],
	.strip .t[aria-selected='true'] {
		background: var(--nimble-crimson);
		color: #fff;
	}
	.rail .t[aria-selected='true'] .bd,
	.strip .t[aria-selected='true'] .bd {
		background: #fff;
		color: var(--nimble-crimson);
	}
</style>
