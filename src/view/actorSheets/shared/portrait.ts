/** The image settings of an actor: the offsets of the portrait and its scale in percent. */
export interface PortraitFlags {
	actorImageXOffset?: number;
	actorImageYOffset?: number;
	actorImageScale?: number;
}

export function portraitFlags(flags: Record<string, unknown> | undefined): Required<PortraitFlags> {
	return {
		actorImageXOffset: Number(flags?.actorImageXOffset ?? 0),
		actorImageYOffset: Number(flags?.actorImageYOffset ?? 0),
		actorImageScale: Number(flags?.actorImageScale ?? 100),
	};
}

export function portraitOf(flags: PortraitFlags): { x: number; y: number; scale: number } {
	return {
		x: flags.actorImageXOffset ?? 0,
		y: flags.actorImageYOffset ?? 0,
		scale: flags.actorImageScale ?? 100,
	};
}
