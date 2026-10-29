import type { DieValuePickerProps } from '#types/components/DieValuePicker.d.ts';
import localize from '#utils/localize.js';

export function createDieValuePickerState(
	getProps: () => Pick<DieValuePickerProps, 'die' | 'feature' | 'sending' | 'onpick' | 'oncancel'>,
) {
	const elements = $state<{ input?: HTMLInputElement }>({});
	// Starts at the die's own value, so the player always picks one.
	let typed = $state<number | null>(getProps().die.value);

	const faces = () => getProps().die.faces;
	const clamp = (next: number) => Math.min(faces(), Math.max(1, Math.trunc(next)));
	const value = $derived(typed === null || Number.isNaN(typed) ? null : clamp(typed));
	const shown = $derived(value ?? getProps().die.value);
	const canSet = $derived(!getProps().sending && value !== null && value !== getProps().die.value);
	const title = $derived(
		getProps().sending
			? localize('NIMBLE.chat.incomingReactions.pickValue.sending', {
					feature: getProps().feature,
				})
			: localize('NIMBLE.chat.incomingReactions.pickValue.title'),
	);

	function set(next: number) {
		typed = clamp(next);
	}

	function confirm() {
		if (canSet && value !== null) getProps().onpick(value);
	}

	function onInputKeydown(event: KeyboardEvent) {
		const next = { ArrowUp: shown + 1, ArrowDown: shown - 1, Home: 1, End: faces() }[event.key];
		if (next !== undefined) {
			event.preventDefault();
			set(next);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			confirm();
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || getProps().sending) return;
		// Foundry opens its main menu on an Escape that reaches the window.
		event.preventDefault();
		event.stopPropagation();
		getProps().oncancel();
	}

	/** A typed value out of range goes back to the nearest face when the input loses focus. */
	function onInputBlur() {
		typed = shown;
	}

	function focusInput() {
		const { input } = elements;
		input?.scrollIntoView?.({ block: 'nearest' });
		input?.focus({ preventScroll: true });
		input?.select();
	}

	return {
		elements,
		get typed() {
			return typed;
		},
		set typed(next: number | null) {
			typed = next;
		},
		get shown() {
			return shown;
		},
		get canSet() {
			return canSet;
		},
		get title() {
			return title;
		},
		set,
		confirm,
		onInputKeydown,
		onKeydown,
		onInputBlur,
		focusInput,
	};
}
