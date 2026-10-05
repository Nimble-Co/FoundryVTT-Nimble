import { getContext, hasContext, setContext } from 'svelte';

const TARGETS_SECTION_KEY = Symbol('targetsSectionShown');

/** Each card that renders move nodes sets this at init: whether it renders a TARGETS section. */
export function setTargetsSectionShown(shown: boolean): void {
	setContext(TARGETS_SECTION_KEY, shown);
}

export function isTargetsSectionShown(): boolean {
	if (!hasContext(TARGETS_SECTION_KEY)) {
		throw new Error(
			'isTargetsSectionShown() was read before setTargetsSectionShown(). A card that renders move nodes must call setTargetsSectionShown() at init.',
		);
	}
	return getContext<boolean>(TARGETS_SECTION_KEY);
}
