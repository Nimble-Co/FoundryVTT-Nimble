import { DEFAULT_MISS_THRESHOLD } from '../utils/damage/missThreshold.js';

/** What lowers the crit face of a die: a crit threshold, a Forced Crit and the miss threshold it reads. */
interface CritFaceOptions {
	criticalThreshold?: unknown;
	forcedCrit?: unknown;
	missThreshold?: unknown;
}

/**
 * The lowest kept face of a die with `faces` sides that is a crit. A crit
 * threshold lowers it, from 1 up to the max. A Forced Crit that always applies
 * makes it 1; one that applies on a hit makes it the lowest face that is not a
 * miss.
 */
export function critFaceOf(faces: number, options: CritFaceOptions = {}): number {
	if (options.forcedCrit === 'always') return 1;
	let face = faces;
	const threshold = Math.trunc(Number(options.criticalThreshold));
	if (Number.isFinite(threshold) && threshold > 0) face = Math.min(face, threshold);
	if (options.forcedCrit === 'onHit') {
		const miss = Math.trunc(Number(options.missThreshold ?? DEFAULT_MISS_THRESHOLD));
		face = Math.min(face, Math.max(1, (Number.isFinite(miss) ? miss : DEFAULT_MISS_THRESHOLD) + 1));
	}
	return face;
}
