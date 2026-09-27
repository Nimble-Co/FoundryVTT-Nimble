import { getContext, setContext } from 'svelte';

const TARGETS_SECTION_KEY = Symbol('targetsSectionShown');

/** The card sets this at init when it renders a TARGETS section. */
export function setTargetsSectionShown(shown: boolean): void {
	setContext(TARGETS_SECTION_KEY, shown);
}

export function isTargetsSectionShown(): boolean {
	return getContext<boolean | undefined>(TARGETS_SECTION_KEY) ?? false;
}
