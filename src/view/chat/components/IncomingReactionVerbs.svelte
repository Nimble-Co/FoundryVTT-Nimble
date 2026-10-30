<script lang="ts">
	import type { IncomingReactionVerbsProps } from '#types/components/IncomingReactionVerbs.d.ts';

	import ChoiceMenu from './ChoiceMenu.svelte';
	import { createIncomingReactionVerbsState } from './IncomingReactionVerbs.svelte.ts';
	import { REACTION_VERB_ICONS } from './reactionVerbs.ts';
	import RollUsePicker from './RollUsePicker.svelte';

	let {
		groups,
		picking,
		busy,
		primaryOutcome,
		text,
		onuse,
		onpick,
		onvalue,
		oncancel,
	}: IncomingReactionVerbsProps = $props();

	const menuId = $props.id();
	const verbsState = createIncomingReactionVerbsState(() => ({
		groups,
		picking,
		text,
		onuse,
		oncancel,
	}));
	const { verbButtons, verbLabel, buttonLabel, toggle, closeMenu, choose, cancelPick } = verbsState;
	let verbs = $derived(verbsState.verbs);
	let open = $derived(verbsState.open);
	let menuSections = $derived(verbsState.menuSections);
</script>

<div class="nimble-reaction-verbs">
	{#each verbs as verb (verb.verb)}
		{@const expanded = open?.verb === verb.verb}
		<button
			bind:this={verbButtons[verb.verb]}
			class="nimble-button nimble-reaction-verb"
			type="button"
			disabled={busy || !!picking?.rolling}
			aria-label={buttonLabel(verb)}
			aria-haspopup="menu"
			aria-expanded={expanded}
			aria-controls={expanded ? menuId : undefined}
			onclick={() => toggle(verb.verb)}
		>
			<i class="nimble-reaction-verb__icon {REACTION_VERB_ICONS[verb.verb]}" aria-hidden="true"></i>
			<span>{verbLabel(verb.verb)}</span>
			{#if verb.count > 1}
				<span class="nimble-reaction-verb__count" aria-hidden="true">{verb.count}</span>
			{/if}
			<i class="nimble-reaction-verb__caret fa-solid fa-angle-down" aria-hidden="true"></i>
		</button>
	{/each}
</div>

{#if picking}
	<RollUsePicker
		{picking}
		feature={text.featureName(picking.entry) || picking.entry.label}
		{primaryOutcome}
		{onpick}
		{onvalue}
		oncancel={cancelPick}
	/>
{:else if open}
	<!-- The menu reads its props one more time while it closes, after `open` is null. -->
	<ChoiceMenu
		id={menuId}
		label={open ? verbLabel(open.verb) : ''}
		sections={menuSections}
		disabled={busy}
		trigger={open ? verbButtons[open.verb] : undefined}
		onchoose={choose}
		onclose={closeMenu}
	/>
{/if}

<style lang="scss">
	.nimble-reaction-verbs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.nimble-reaction-verb {
		flex: 1 1 auto;
		gap: 0.375rem;
		margin: 0;
		padding: 0.3125rem 0.5rem;
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		line-height: 1.2;
		white-space: nowrap;

		&[aria-expanded='true'] {
			background: color-mix(in srgb, currentColor 12%, transparent);
		}

		&:focus-visible {
			outline: 2px solid var(--nimble-dark-text-color);
			outline-offset: 1px;
		}

		&:disabled {
			cursor: default;
			opacity: 0.6;
		}

		&__icon {
			line-height: 0;
		}

		&__count {
			display: inline-grid;
			place-items: center;
			min-width: 1.125rem;
			height: 1.125rem;
			padding: 0 0.25rem;
			font-size: var(--nimble-xs-text);
			font-variant-numeric: tabular-nums;
			color: var(--nimble-medium-text-color);
			background: color-mix(in srgb, currentColor 14%, transparent);
			border-radius: 999px;
		}

		&__caret {
			font-size: 0.75em;
			color: var(--nimble-medium-text-color);
			transition: transform 120ms ease-out;
		}

		&[aria-expanded='true'] &__caret {
			transform: rotate(180deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nimble-reaction-verb__caret {
			transition: none;
		}
	}
</style>
