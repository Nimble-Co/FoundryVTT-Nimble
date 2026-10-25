import { tick } from 'svelte';
import type {
	RollRerollButtonProps,
	RollRerollChoice,
} from '#types/components/RollRerollButton.d.ts';
import localize from '#utils/localize.js';

export function createRollRerollButtonState(
	getProps: () => Pick<RollRerollButtonProps, 'choices' | 'onChoose'>,
) {
	let open = $state(false);
	const elements = $state<{
		trigger?: HTMLButtonElement;
		menu?: HTMLUListElement;
		items: HTMLButtonElement[];
	}>({ items: [] });

	const single = $derived(getProps().choices.length === 1 ? getProps().choices[0] : null);
	const menuOpen = $derived(open && !single);
	const triggerLabel = $derived(
		single ? choiceText(single) : localize('NIMBLE.chat.incomingReactions.rerollChoose'),
	);

	function choiceText(choice: RollRerollChoice): string {
		if (!choice.cost) return choice.label;
		return localize('NIMBLE.chat.incomingReactions.rerollWithCost', {
			label: choice.label,
			cost: choice.cost,
		});
	}

	async function onTriggerClick() {
		if (single) {
			getProps().onChoose(single.id);
			return;
		}
		open = !open;
		await tick();
		if (!open) return;
		elements.menu?.scrollIntoView?.({ block: 'nearest' });
		elements.items[0]?.focus({ preventScroll: true });
	}

	function choose(id: string) {
		closeMenu();
		getProps().onChoose(id);
	}

	function closeMenu(returnFocus = false) {
		open = false;
		if (returnFocus) elements.trigger?.focus();
	}

	function onMenuKeydown(event: KeyboardEvent) {
		const current = elements.items.indexOf(event.target as HTMLButtonElement);
		const last = getProps().choices.length - 1;
		const next = {
			ArrowDown: current >= last ? 0 : current + 1,
			ArrowUp: current <= 0 ? last : current - 1,
			Home: 0,
			End: last,
		}[event.key];

		if (next !== undefined) {
			event.preventDefault();
			elements.items[next]?.focus();
		} else if (event.key === 'Escape') {
			// Foundry opens its main menu on an Escape that reaches the window.
			event.preventDefault();
			event.stopPropagation();
			closeMenu(true);
		} else if (event.key === 'Tab') {
			closeMenu();
		}
	}

	function onWindowPointerDown(event: PointerEvent) {
		const target = event.target as Node | null;
		if (!menuOpen || elements.trigger?.contains(target) || elements.menu?.contains(target)) return;
		closeMenu();
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
		choiceText,
		onTriggerClick,
		choose,
		onMenuKeydown,
		onWindowPointerDown,
	};
}
