import { tick } from 'svelte';
import type { RerollDiePickerProps } from '#types/components/RerollDiePicker.d.ts';
import type { RollUse } from '#utils/incomingReactions/incomingReactionEntry.ts';
import localize from '#utils/localize.js';
import type { PickableDie } from '../../../dice/oneDieReroll.js';
import { claimEscape } from './claimEscape.ts';
import { rovingFocusIndex } from './rovingFocusIndex.ts';

/**
 * The word under a die: the Primary Die and a dropped die always say what
 * they are; a kept die says so only next to a dropped one.
 */
export function dieCaption(die: PickableDie, dice: readonly PickableDie[]): string {
	if (die.role === 'primary' || die.role === 'dropped') {
		return localize(`NIMBLE.chat.incomingReactions.pickDie.roles.${die.role}`);
	}
	if (die.role === 'kept' && dice.some((other) => other.role === 'dropped')) {
		return localize('NIMBLE.chat.incomingReactions.pickDie.roles.kept');
	}
	return '';
}

export function pickDieWords(use: RollUse = 'reroll'): string {
	return use === 'change'
		? 'NIMBLE.chat.incomingReactions.pickDie.change'
		: 'NIMBLE.chat.incomingReactions.pickDie';
}

export function dieLabel(
	die: PickableDie,
	dice: readonly PickableDie[],
	use: RollUse = 'reroll',
): string {
	const role = dieCaption(die, dice);
	const value = String(die.value);
	return role
		? localize(`${pickDieWords(use)}.dieWithRole`, { value, role })
		: localize(`${pickDieWords(use)}.die`, { value });
}

export function createRerollDiePickerState(
	getProps: () => Pick<
		RerollDiePickerProps,
		'dice' | 'oncancel' | 'rolling' | 'several' | 'onpick'
	>,
) {
	const elements = $state<{ root?: HTMLElement; dice: HTMLButtonElement[] }>({ dice: [] });
	let picked = $state<PickableDie[]>([]);
	const atMax = $derived(!!getProps().several && picked.length >= (getProps().several?.max ?? 0));

	const isPicked = (die: PickableDie) =>
		picked.some((other) => other.term === die.term && other.result === die.result);

	function onDie(die: PickableDie) {
		if (!getProps().several) return getProps().onpick(die);
		picked = isPicked(die)
			? picked.filter((other) => other.term !== die.term || other.result !== die.result)
			: [...picked, die];
	}

	function isRolling(die: PickableDie) {
		const { several, rolling } = getProps();
		return several
			? !!rolling && isPicked(die)
			: rolling?.term === die.term && rolling.result === die.result;
	}

	/** Focus the Primary Die, else the first die, when the picker opens. */
	async function focusFirst() {
		await tick();
		const dice = getProps().dice;
		const primary = dice.findIndex((die) => die.role === 'primary');
		const first = elements.dice[primary === -1 ? 0 : primary];
		elements.root?.scrollIntoView?.({ block: 'nearest' });
		first?.focus({ preventScroll: true });
	}

	function onKeydown(event: KeyboardEvent) {
		if (getProps().rolling) return;
		const current = elements.dice.indexOf(event.target as HTMLButtonElement);
		const last = getProps().dice.length - 1;
		const next = rovingFocusIndex(event.key, current, last, 'both');

		if (next !== undefined && current !== -1) {
			event.preventDefault();
			elements.dice[next]?.focus();
		} else if (claimEscape(event)) {
			getProps().oncancel();
		}
	}

	return {
		elements,
		focusFirst,
		onKeydown,
		onDie,
		isPicked,
		isRolling,
		get picked() {
			return picked;
		},
		get atMax() {
			return atMax;
		},
	};
}
