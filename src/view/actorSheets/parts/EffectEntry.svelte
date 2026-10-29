<!--
@component
One entry on the Effects tab. The tab has three sections, each with a `GroupHeading`: Active effects, Conditions, Passive effects.
Every entry has the same parts: the name, its source or what it is attached to, how long it lasts, and its text when you click the name.
`own` marks an effect that your own feature put on you; only then is there a control to end it, and the bar asks first.
-->
<script lang="ts">
	import type { EffectEntryProps } from '#types/components/actorSheets/EffectEntry.d.ts';
	import localize from '#utils/localize.js';
	import ConfirmBar from './ConfirmBar.svelte';

	let {
		name,
		icon = 'fa-solid fa-circle',
		source,
		duration,
		text,
		own = false,
		open = $bindable(false),
		endLabel,
		onend,
	}: EffectEntryProps = $props();

	let asking = $state(false);
	const verb = $derived(endLabel ?? localize('NIMBLE.actorSheet.parts.effectEntry.end'));
	const endText = $derived(localize('NIMBLE.actorSheet.parts.effectEntry.endName', { verb, name }));
	const textToggle = $derived(
		localize(
			open
				? 'NIMBLE.actorSheet.parts.effectEntry.hideText'
				: 'NIMBLE.actorSheet.parts.effectEntry.showText',
			{ name },
		),
	);
</script>

<div class="fx" class:own>
	<div class="hd">
		<button
			type="button"
			class="nimble-u-reset-button nm"
			aria-expanded={open}
			data-tooltip={textToggle}
			onclick={() => (open = !open)}
		>
			<i class="fa-solid fa-chevron-right ch"></i><i class="{icon} ic"></i>
			<span
				><b>{name}</b>
				{#if source}<small>{source}</small>{/if}</span
			>
		</button>
		{#if duration}
			<span class="dur" data-tooltip={localize('NIMBLE.actorSheet.parts.effectEntry.duration')}
				>{duration}</span
			>
		{/if}
		{#if own && onend}
			<button
				type="button"
				class="nimble-u-reset-button end"
				data-tooltip={endText}
				aria-label={endText}
				onclick={() => (asking = true)}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		{/if}
	</div>
	{#if open && text}<p>{text}</p>{/if}
	{#if asking}
		<div class="askw">
			<ConfirmBar
				question={localize('NIMBLE.actorSheet.parts.effectEntry.endQuestion', { verb, name })}
				confirmLabel={verb}
				onconfirm={() => {
					asking = false;
					onend?.();
				}}
				oncancel={() => (asking = false)}
			/>
		</div>
	{/if}
</div>

<style>
	.fx {
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		background: var(--nimble-ui-well);
		font-family: var(--nimble-primary-font);
	}
	.own {
		border-color: var(--nimble-ui-own);
		background: var(--nimble-ui-own-background);
	}
	.hd {
		display: flex;
		align-items: center;
		gap: 3px;
		min-height: 30px;
		padding-right: 3px;
	}
	.nm {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 30px;
		padding: 2px 4px 2px 7px;
		border-radius: 4px;
		font-size: 0.929rem;
		line-height: 1.15;
		color: var(--nimble-ui-ink);
		text-align: left;
	}
	.nm:hover {
		background: var(--nimble-ui-hover);
	}
	.ch {
		flex: none;
		font-size: 0.643rem;
		color: var(--nimble-ui-ink-dim);
		transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.nm[aria-expanded='true'] .ch {
		transform: rotate(90deg);
	}
	.ic {
		width: 14px;
		font-size: 0.786rem;
		text-align: center;
		color: var(--nimble-ui-highlight);
	}
	.nm span {
		min-width: 0;
	}
	b {
		font-weight: 600;
	}
	small {
		font-size: 0.833rem;
		font-weight: 500;
		color: var(--nimble-ui-ink-muted);
	}
	.dur {
		flex: none;
		padding: 0 5px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 3px;
		font: 700 0.786rem/18px var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
		white-space: nowrap;
	}
	.end {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 4px;
		font-size: 0.786rem;
		color: var(--nimble-ui-ink-dim);
	}
	.end:hover {
		color: var(--nimble-ui-ink);
		background: var(--nimble-ui-hover);
	}
	p {
		margin: 0;
		padding: 0 8px 7px 9px;
		font-size: 0.893rem;
		line-height: 1.35;
		color: var(--nimble-ui-ink-muted);
		text-wrap: pretty;
	}
	.askw {
		margin: 0 6px 6px;
	}
</style>
