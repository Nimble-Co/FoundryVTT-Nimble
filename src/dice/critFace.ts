/** The lowest face of a die with `faces` sides that is a crit: the threshold, from 1 up to the max. */
export function critFaceOf(faces: number, criticalThreshold?: unknown): number {
	const threshold = Math.trunc(Number(criticalThreshold));
	if (!Number.isFinite(threshold) || threshold <= 0) return faces;
	return Math.min(threshold, faces);
}
