/**
 * Font-Awesome class names per die size. Kept in a dependency-free module so
 * any UI surface (sheet tracker, activation dialog, chat card) can import the
 * helper without dragging actor/document types through the import graph.
 */
const DIE_FACE_ICONS: Record<string, string> = {
	d4: 'fa-dice-d4',
	d6: 'fa-dice-d6',
	d8: 'fa-dice-d8',
	d10: 'fa-dice-d10',
	d12: 'fa-dice-d12',
	d20: 'fa-dice-d20',
};

export function getDieFaceIcon(dieSize: string | null | undefined): string {
	if (!dieSize) return 'fa-dice-d6';
	return DIE_FACE_ICONS[dieSize] ?? 'fa-dice-d6';
}
