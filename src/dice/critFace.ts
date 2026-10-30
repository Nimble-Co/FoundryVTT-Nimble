import { DEFAULT_MISS_THRESHOLD } from '../utils/damage/missThreshold.js';

/**
 * What lowers the crit face of a die: a crit threshold, a crit range (crit on
 * N less than the max), a Forced Crit and the miss threshold it reads.
 */
interface CritFaceOptions {
	criticalThreshold?: unknown;
	critRange?: unknown;
	forcedCrit?: unknown;
	missThreshold?: unknown;
}

/**
 * The lowest kept face of a die with `faces` sides that is a crit. A crit
 * threshold or a crit range lowers it, down to 1. A Forced Crit that always
 * applies makes it 1; one that applies on a hit makes it the lowest face that
 * is not a miss.
 */
export function critFaceOf(faces: number, options: CritFaceOptions = {}): number {
	if (options.forcedCrit === 'always') return 1;
	let face = faces;
	const threshold = Math.trunc(Number(options.criticalThreshold));
	if (Number.isFinite(threshold) && threshold > 0) face = Math.min(face, threshold);
	const range = Math.trunc(Number(options.critRange));
	if (Number.isFinite(range) && range > 0) face = Math.max(1, Math.min(face, faces - range));
	if (options.forcedCrit === 'onHit') {
		const miss = Math.trunc(Number(options.missThreshold ?? DEFAULT_MISS_THRESHOLD));
		face = Math.min(face, Math.max(1, (Number.isFinite(miss) ? miss : DEFAULT_MISS_THRESHOLD) + 1));
	}
	return face;
}
