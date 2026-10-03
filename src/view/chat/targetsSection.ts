import { getContext, setContext } from 'svelte';

const TARGETS_SECTION_KEY = Symbol('targetsSectionShown');

/** Each card that renders move nodes sets this at init: whether it renders a TARGETS section. */
export function setTargetsSectionShown(shown: boolean): void {
	setContext(TARGETS_SECTION_KEY, shown);
}

export function isTargetsSectionShown(): boolean {
	return getContext<boolean | undefined>(TARGETS_SECTION_KEY) ?? false;
}
