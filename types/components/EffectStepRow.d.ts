import type { LinkedPart } from '#utils/documents/docLink.ts';

export interface EffectStepRowProps {
	img: string;
	name: string;
	/** The document the name opens, for a user who may see it. */
	uuid?: string | null;
	/** The Lasts Until line under the name. */
	lasts?: string;
	/** After the click: who took it, each with a check. */
	appliedLines: readonly (string | readonly LinkedPart[])[];
	/** Lines in place of the button, or under the applied lines. */
	notes: readonly string[];
	button: { label: string; disabled: boolean; tooltip: string | null } | null;
	busy: boolean;
	onApply(): void;
}
