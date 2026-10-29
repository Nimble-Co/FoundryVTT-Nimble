<script lang="ts">
	import type { ChoiceMenuSection } from '#types/components/ChoiceMenu.d.ts';
	import type { IncomingReactionVerbsProps } from '#types/components/IncomingReactionVerbs.d.ts';

	import { tick } from 'svelte';
	import localize from '#utils/localize.js';
	import ChoiceMenu from './ChoiceMenu.svelte';
	import {
		groupByVerb,
		REACTION_VERB_ICONS,
		REACTION_VERB_WORDS,
		type ReactionVerb,
		type ReactionVerbGroup,
		reactionVerb,
	} from './reactionVerbs.ts';
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
	const verbButtons = $state<Partial<Record<ReactionVerb, HTMLButtonElement>>>({});
	let openVerb = $state<ReactionVerb | null>(null);

	let verbs = $derived(groupByVerb(groups));
	// A menu whose last entry went away closes with it.
	let open = $derived(verbs.find((verb) => verb.verb === openVerb) ?? null);
	let menuSections = $derived(open ? sections(open) : []);

	const verbLabel = (verb: ReactionVerb) => localize(REACTION_VERB_WORDS[verb]);

	function buttonLabel({ verb, count }: ReactionVerbGroup): string {
		if (count < 2) return verbLabel(verb);
		return localize('NIMBLE.chat.incomingReactions.verbCount', {
			verb: verbLabel(verb),
			count: String(count),
		});
	}

	function sections({ groups: verbGroups }: ReactionVerbGroup): ChoiceMenuSection[] {
		return verbGroups.map((group) => ({
			id: group.actorUuid,
			heading: group.name,
			items: group.entries.map(text.menuItem),
		}));
	}

	async function focusVerb(verb: ReactionVerb | null): Promise<void> {
		await tick();
		if (verb) verbButtons[verb]?.focus();
	}

	function toggle(verb: ReactionVerb): void {
		if (picking) oncancel();
		openVerb = openVerb === verb ? null : verb;
	}

	function closeMenu(returnFocus: boolean): void {
		const verb = openVerb;
		openVerb = null;
		if (returnFocus) void focusVerb(verb);
	}

	function choose(entryId: string): void {
		const entry = open?.groups.flatMap((group) => group.entries).find(({ id }) => id === entryId);
		const verb = openVerb;
		openVerb = null;
		// Now, not after a tick: a picker that opens takes the focus from here.
		if (verb) verbButtons[verb]?.focus();
		if (entry) onuse(entry);
	}

	function cancelPick(): void {
		const verb = picking ? reactionVerb(picking.entry) : null;
		oncancel();
		void focusVerb(verb);
	}
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
	<ChoiceMenu
		id={menuId}
		label={verbLabel(open.verb)}
		sections={menuSections}
		disabled={busy}
		trigger={verbButtons[open.verb]}
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
