import { tick } from 'svelte';
import type { ChoiceMenuSection } from '#types/components/ChoiceMenu.d.ts';
import type {
	IncomingReactionVerbsProps,
	ReactionVerb,
	ReactionVerbGroup,
} from '#types/components/IncomingReactionVerbs.d.ts';
import localize from '#utils/localize.js';
import { groupByVerb, REACTION_VERB_WORDS, reactionVerb } from './reactionVerbs.ts';

export function createIncomingReactionVerbsState(
	getProps: () => Pick<
		IncomingReactionVerbsProps,
		'groups' | 'picking' | 'text' | 'onuse' | 'oncancel'
	>,
) {
	const verbButtons = $state<Partial<Record<ReactionVerb, HTMLButtonElement>>>({});
	let openVerb = $state<ReactionVerb | null>(null);

	const verbs = $derived(groupByVerb(getProps().groups));
	// A menu whose last entry went away closes with it.
	const open = $derived(verbs.find((verb) => verb.verb === openVerb) ?? null);
	const menuSections = $derived<ChoiceMenuSection[]>(
		open
			? open.groups.map((group) => ({
					id: group.actorUuid,
					heading: group.name,
					items: group.entries.map(getProps().text.menuItem),
				}))
			: [],
	);

	const verbLabel = (verb: ReactionVerb) => localize(REACTION_VERB_WORDS[verb]);

	function buttonLabel({ verb, count }: ReactionVerbGroup): string {
		if (count < 2) return verbLabel(verb);
		return localize('NIMBLE.chat.incomingReactions.verbCount', {
			verb: verbLabel(verb),
			count: String(count),
		});
	}

	async function focusVerb(verb: ReactionVerb | null): Promise<void> {
		await tick();
		if (verb) verbButtons[verb]?.focus();
	}

	function toggle(verb: ReactionVerb): void {
		if (getProps().picking) getProps().oncancel();
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
		if (entry) getProps().onuse(entry);
	}

	function cancelPick(): void {
		const { picking, oncancel } = getProps();
		const verb = picking ? reactionVerb(picking.entry) : null;
		oncancel();
		void focusVerb(verb);
	}

	return {
		verbButtons,
		get verbs() {
			return verbs;
		},
		get open() {
			return open;
		},
		get menuSections() {
			return menuSections;
		},
		verbLabel,
		buttonLabel,
		toggle,
		closeMenu,
		choose,
		cancelPick,
	};
}
