export interface EffectStepRowProps {
	img: string;
	name: string;
	/** The Lasts Until line under the name. */
	lasts?: string;
	/** After the click: who took it, each with a check. */
	appliedLines: readonly string[];
	/** Lines in place of the button, or under the applied lines. */
	notes: readonly string[];
	button: { label: string; disabled: boolean; tooltip: string | null } | null;
	busy: boolean;
	onApply(): void;
}
