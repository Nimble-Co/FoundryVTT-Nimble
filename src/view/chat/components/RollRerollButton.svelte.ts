import type { RollRerollButtonProps } from '#types/components/RollRerollButton.d.ts';
import localize from '#utils/localize.js';

export function createRollRerollButtonState(
	getProps: () => Pick<RollRerollButtonProps, 'sections' | 'onChoose'>,
) {
	let open = $state(false);
	const elements = $state<{ trigger?: HTMLButtonElement }>({});

	const items = $derived(getProps().sections.flatMap((section) => section.items));
	const single = $derived(items.length === 1 ? items[0] : null);
	const menuOpen = $derived(open && !single);
	const changesOnly = $derived(
		getProps().sections.every((section) => section.id === 'change' || section.items.length === 0),
	);
	const triggerLabel = $derived.by(() => {
		if (single) return single.text;
		const changes = getProps().sections.some(
			(section) => section.id === 'change' && section.items.length > 0,
		);
		return localize(
			changes
				? 'NIMBLE.chat.incomingReactions.rollMenu.choose'
				: 'NIMBLE.chat.incomingReactions.rerollChoose',
		);
	});

	function onTriggerClick() {
		if (single) {
			getProps().onChoose(single.id);
			return;
		}
		open = !open;
	}

	function choose(id: string) {
		open = false;
		// Now, not after a tick: a picker that opens takes the focus from here.
		elements.trigger?.focus();
		getProps().onChoose(id);
	}

	function closeMenu(returnFocus: boolean) {
		open = false;
		if (returnFocus) elements.trigger?.focus();
	}

	return {
		elements,
		get single() {
			return single;
		},
		get menuOpen() {
			return menuOpen;
		},
		get triggerLabel() {
			return triggerLabel;
		},
		get changesOnly() {
			return changesOnly;
		},
		onTriggerClick,
		choose,
		closeMenu,
	};
}
