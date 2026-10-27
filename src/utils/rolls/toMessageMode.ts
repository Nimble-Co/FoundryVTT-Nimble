/**
 * Nimble's roll dialogs and roll options still use Foundry's legacy roll-mode
 * vocabulary ('publicroll', 'gmroll', 'blindroll', 'selfroll'). Foundry V14
 * replaced that vocabulary with message modes — keys of
 * CONFIG.ChatMessage.modes — consumed by ChatMessage.applyMode and the
 * messageMode option of Roll#toMessage. Convert at that boundary; new-style
 * keys pass through unchanged.
 *
 * Returns undefined for empty input so ChatMessage.applyMode and
 * Roll#toMessage fall back to the user's core.messageMode setting.
 */
const LEGACY_ROLL_MODES: Record<string, string> = {
	publicroll: 'public',
	gmroll: 'gm',
	blindroll: 'blind',
	selfroll: 'self',
};

export default function toMessageMode(mode: string | null | undefined): string | undefined {
	if (!mode) return undefined;
	return LEGACY_ROLL_MODES[mode] ?? mode;
}
