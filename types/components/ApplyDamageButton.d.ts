export interface ApplyDamageButtonProps {
	/** The card's damage group, read only for the disposition hint */
	nodes?: Array<{ targetDisposition?: 'friendly' | 'neutral' | 'hostile' | 'secret' }>;
	/**
	 * Set to apply one packet on its own instead of the whole card. Only
	 * save-gated damage needs this: the card-level pass excludes it, because
	 * whether a target takes full or half is not known until they roll.
	 */
	packet?: { total: number; options: Record<string, unknown> };
}
