<!--
@component
One thing in a list on the character sheet: an item, a spell, a feature, a reaction or an effect (a "row", CONTEXT.md).

- A click on the row uses the thing. An attack or a spell opens the roll window first; it never spends at once.
- The arrow at the start shows the full text and the facts: cost, when, range, damage, uses, quantity, source. The first line stays, so the name and the cost do not move. `descriptionHtml` (the text that Foundry enriched, with inline rolls and links) replaces the plain `description`.
- The pen at the end opens the window of the thing. Delete is not in that window: the sheet puts it in `fields`. A row with no window keeps an empty place (`hasWindow={false}`).
- A row is 44 px high (52 px with `touch`). No lines between rows: the line under each group heading separates the groups.

An item that you can equip gets `onequip`: the tag after the name is then a toggle, EQUIPPED or EQUIP.
The row stays one button with the tag on top of it.

In edit mode, `fields` replaces the cost with the numbers that you type, and the row does not act. `dim` fades a row that has no window.
-->
<script lang="ts">
	import type { RowProps } from '#types/components/actorSheets/Row.d.ts';
	import localize from '#utils/localize.js';
	import RowButton from './RowButton.svelte';
	import RowCost from './RowCost.svelte';
	import RowTile from './RowTile.svelte';

	let {
		name,
		img,
		icon,
		tag,
		tagOn = false,
		onequip,
		equipped = false,
		summary,
		summaryTone,
		cost = {},
		description,
		descriptionHtml,
		facts = [],
		state: rowState,
		open = $bindable(false),
		ontoggle,
		onuse,
		useLabel,
		useExpanded,
		disabled,
		onedit,
		hasWindow = true,
		fields,
		dim = false,
		children,
		touch = false,
		id,
	}: RowProps = $props();

	const pid = $derived(id ? `${id}-text` : undefined);
	const off = $derived(disabled ?? rowState === 'out');
	const toggle = () => (ontoggle ? ontoggle() : (open = !open));
	const useText = $derived(useLabel ?? localize('NIMBLE.actorSheet.parts.row.use', { name }));
	const equipText = $derived(
		localize(
			equipped
				? 'NIMBLE.actorSheet.parts.row.unequipName'
				: 'NIMBLE.actorSheet.parts.row.equipName',
			{ name },
		),
	);
</script>

{#snippet face(withCost: boolean)}
	<RowTile {img} {icon} />
	<span class="tx">
		<span class="nm">
			<span>{name}</span>
			{#if onequip}
				<button
					type="button"
					class="nimble-u-reset-button eqt"
					aria-pressed={equipped}
					data-tooltip={equipText}
					onclick={onequip}
				>
					{localize(
						equipped ? 'NIMBLE.actorSheet.parts.row.equipped' : 'NIMBLE.actorSheet.parts.row.equip',
					)}
				</button>
			{:else if tag}
				<em class="tag" class:on={tagOn}>{tag}</em>
			{/if}
		</span>
		{#if summary}<span class="sm {summaryTone ?? ''}">{summary}</span>{/if}
	</span>
	{#if withCost}<RowCost {...cost} />{/if}
{/snippet}

<div class="row {rowState ?? ''}" class:open class:touch class:dim>
	<div class="rw">
		<span class="x">
			<RowButton kind="expand" {open} {name} controls={pid} {touch} onclick={toggle} />
		</span>
		{#if fields}
			<div class="main">
				{@render face(false)}
				<span class="fz">{@render fields()}</span>
			</div>
		{:else if onuse && onequip}
			<!-- the use button fills the row, under the face; only the equip toggle takes the pointer above it -->
			<div class="main stretch">
				<button
					type="button"
					class="nimble-u-reset-button use"
					aria-disabled={off || undefined}
					aria-label={useText}
					aria-expanded={useExpanded}
					onclick={off ? undefined : onuse}
				></button>
				{@render face(true)}
			</div>
		{:else if onuse}
			<button
				type="button"
				class="nimble-u-reset-button main"
				aria-disabled={off || undefined}
				aria-label={useText}
				aria-expanded={useExpanded}
				onclick={off ? undefined : onuse}
			>
				{@render face(true)}
			</button>
		{:else}
			<div class="main">{@render face(true)}</div>
		{/if}
		<RowButton kind={hasWindow ? 'edit' : 'spacer'} {name} {touch} onclick={onedit} />
	</div>
	{#if open}
		<div class="xpn" id={pid}>
			{#if descriptionHtml}
				<div class="text">{@html descriptionHtml}</div>
			{:else if description}<p>{description}</p>{/if}
			{#if facts.length}
				<dl>
					{#each facts as [k, v]}<div>
							<dt>{k}</dt>
							<dd>{v}</dd>
						</div>{/each}
				</dl>
			{/if}
		</div>
	{/if}
	{@render children?.()}
</div>

<style>
	.row {
		position: relative;
		font-family: var(--nimble-primary-font);
	}
	.rw {
		display: flex;
		align-items: center;
		gap: 2px;
		border-radius: 4px;
		transition: background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.main {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: 32px minmax(0, 1fr) auto;
		align-items: center;
		gap: 0 10px;
		min-height: 44px;
		padding: 4px 8px 4px 4px;
		border-radius: 4px;
		text-align: left;
		-webkit-user-select: none;
		user-select: none;
		touch-action: manipulation;
		transition: background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	button.main:hover,
	.stretch:has(> .use:hover) {
		background: var(--nimble-ui-hover);
	}
	button.main:active,
	.stretch:has(> .use:active) {
		background: var(--nimble-ui-soft);
	}
	.stretch {
		position: relative;
	}
	.use {
		position: absolute;
		inset: 0;
		border-radius: 4px;
	}
	.stretch > :global(:not(.use)) {
		position: relative;
		pointer-events: none;
	}
	/* Foundry stops the pointer on button children; the cost marks need it for their tooltips */
	.row:not(.dim) .main:not(.stretch) :global(.cost [data-tooltip]) {
		pointer-events: auto;
	}
	.out .use,
	.use[aria-disabled='true'] {
		cursor: default;
	}
	.eqt {
		position: relative;
		pointer-events: auto;
		padding: 0 5px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 3px;
		font: 800 0.656rem/14px var(--nimble-primary-font);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--nimble-ui-ink);
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	/* a 24 px target (32 px on a phone) round the small tag */
	.eqt::before {
		content: '';
		position: absolute;
		inset: -5px -6px;
	}
	.touch .eqt::before {
		inset: -9px -8px;
	}
	.eqt[aria-pressed='false'] {
		border-style: dashed;
		border-color: var(--nimble-ui-edge);
		color: var(--nimble-ui-ink-muted);
	}
	.eqt:hover {
		border-style: solid;
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
		color: var(--nimble-ui-ink);
	}
	.eqt:active {
		background: var(--nimble-ui-soft);
	}
	.x {
		display: contents;
	}
	/* the arrow and the pen take the height of the row, so the three hover fills line up */
	.rw :global(.rb) {
		align-self: stretch;
		height: auto;
	}
	.x :global(.rb) {
		width: 26px;
		margin-right: -2px;
	}
	.touch .x :global(.rb) {
		width: 34px;
	}
	.tx {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.nm {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px 7px;
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--nimble-ui-ink);
	}
	.tag {
		font-style: normal;
		padding: 0 5px;
		border-radius: 3px;
		font: 800 0.656rem/16px var(--nimble-primary-font);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
		color: var(--nimble-ui-ink-muted);
	}
	.tag.on {
		box-shadow: none;
		background: var(--nimble-crimson);
		color: #fff;
	}
	.sm {
		font-size: 0.781rem;
		font-weight: 500;
		line-height: 1.3;
		color: var(--nimble-ui-ink-muted);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.sm.act {
		color: var(--nimble-ui-action);
	}
	.sm.warn {
		color: var(--nimble-ui-warn);
	}
	.fz {
		position: relative;
		z-index: 3;
		display: flex;
		align-items: center;
		gap: 11px;
		justify-self: end;
	}
	.active .rw {
		background: var(--nimble-ui-own-background);
	}
	.active :global(.tile) {
		background: var(--nimble-crimson);
		color: #fff;
	}
	.just .rw {
		background: var(--nimble-ui-action-background);
	}
	.out .nm,
	.used .nm {
		color: var(--nimble-ui-ink-muted);
	}
	.out :global(.tile),
	.used :global(.tile) {
		background: var(--nimble-ui-soft);
		color: var(--nimble-ui-ink-muted);
	}
	.out button.main,
	button.main[aria-disabled='true'] {
		cursor: default;
	}
	.out button.main:hover {
		background: transparent;
	}
	.touch .main {
		min-height: 52px;
	}
	.dim .eqt {
		pointer-events: none;
	}
	.dim .main {
		opacity: 0.45;
		pointer-events: none;
	}
	.xpn {
		display: flex;
		flex-direction: column;
		gap: 9px;
		padding: 0 8px 12px 74px;
		animation: reveal 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.touch .xpn {
		padding-left: 82px;
	}
	.xpn p,
	.text {
		margin: 0;
		max-width: 68ch;
		font-size: 0.813rem;
		line-height: 1.45;
		color: var(--nimble-ui-ink);
		text-wrap: pretty;
	}
	.text :global(p) {
		margin: 0 0 6px;
	}
	.text :global(p:last-child) {
		margin-bottom: 0;
	}
	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 4px 10px;
		margin: 0;
		font-size: 0.781rem;
		line-height: 1.3;
	}
	dl div {
		display: contents;
	}
	dt {
		font-weight: 800;
		color: var(--nimble-ui-ink-dim);
	}
	dd {
		margin: 0;
		color: var(--nimble-ui-ink);
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
