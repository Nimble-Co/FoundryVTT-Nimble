type TargetDisposition = 'friendly' | 'neutral' | 'hostile' | 'secret';
type DispositionEmphasis = 'recommended' | 'neutral' | 'discouraged';

const DISPOSITION_LOOKUP: Record<string, number> = {
	friendly: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
	neutral: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
	hostile: CONST.TOKEN_DISPOSITIONS.HOSTILE,
	secret: CONST.TOKEN_DISPOSITIONS.SECRET,
};

const OPPOSITE_DISPOSITION: Partial<Record<TargetDisposition, number>> = {
	friendly: CONST.TOKEN_DISPOSITIONS.HOSTILE,
	hostile: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
};

export function useDispositionState(
	getTargetDisposition: () => TargetDisposition | undefined,
	getTargetUuids: () => string[],
) {
	let controlledDispositions = $state<number[]>([]);

	const dispositionState = $derived.by((): DispositionEmphasis => {
		const targetDisposition = getTargetDisposition();
		if (!targetDisposition) return 'neutral';

		const required = DISPOSITION_LOOKUP[targetDisposition];
		const allDispositions: number[] = [...controlledDispositions];

		for (const uuid of getTargetUuids()) {
			const doc = fromUuidSync(uuid) as TokenDocument | null;
			const disp = (doc as { disposition?: number } | null)?.disposition;
			if (typeof disp === 'number') allDispositions.push(disp);
		}

		if (allDispositions.length === 0) return 'neutral';
		if (allDispositions.some((d) => d === required)) return 'recommended';

		const opposite = OPPOSITE_DISPOSITION[targetDisposition];
		if (opposite !== undefined && allDispositions.every((d) => d === opposite))
			return 'discouraged';

		return 'neutral';
	});

	$effect(() => {
		function syncControlled() {
			controlledDispositions = (canvas?.tokens?.controlled ?? []).map((t) => {
				const doc = t.document as TokenDocument | null;
				return doc?.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY;
			});
		}
		syncControlled();
		const hookId = Hooks.on('controlToken', syncControlled);
		return () => {
			Hooks.off('controlToken', hookId);
		};
	});

	return {
		get dispositionState() {
			return dispositionState;
		},
	};
}
