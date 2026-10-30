import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import localize from '#utils/localize.js';

/** A number beside the Primary Die face, such as "+3": its text and who added it. */
interface PrimaryDieBonusText {
	label: string;
	tooltip: string;
}

function signed(value: number): string {
	return value > 0 ? `+${value}` : String(value);
}

/**
 * The number `total` added after the Primary Die, with each feature that
 * added a part of it. The part no feature added came from the attack dialog.
 */
function primaryDieBonusText(
	total: number,
	lines: readonly PrimaryDieBonusLine[],
): PrimaryDieBonusText | null {
	if (!total) return null;
	const parts = lines
		.filter((line) => line.value)
		.map((line) => `${line.label} ${signed(line.value)}`);
	const fromDialog = total - lines.reduce((sum, line) => sum + line.value, 0);
	if (fromDialog) {
		parts.push(localize('NIMBLE.chat.primaryDieBonus.dialog', { value: signed(fromDialog) }));
	}
	return { label: signed(total), tooltip: parts.join(', ') };
}

export { primaryDieBonusText, signed, type PrimaryDieBonusText };
