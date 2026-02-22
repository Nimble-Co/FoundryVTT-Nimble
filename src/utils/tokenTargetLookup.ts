interface TokenTargetReference {
	id?: string | null;
	name?: string | null;
	uuid?: string | null;
	document?: {
		id?: string | null;
		name?: string | null;
		uuid?: string | null;
	};
}

interface CanvasTokenReference {
	id?: string | null;
	name?: string | null;
	document?: {
		id?: string | null;
		name?: string | null;
		uuid?: string | null;
	};
}

function normalizeOptionalString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function doesTargetMatchTokenId(target: TokenTargetReference, targetTokenId: string): boolean {
	return target.id === targetTokenId || target.document?.id === targetTokenId;
}

function getUserTargetMatches(targetTokenId: string): TokenTargetReference | null {
	const selectedTargets = Array.from(game.user?.targets ?? []) as unknown as TokenTargetReference[];
	return (
		selectedTargets.find((target) => doesTargetMatchTokenId(target, targetTokenId)) ?? null
	);
}

function getCanvasTokenMatches(targetTokenId: string): CanvasTokenReference | null {
	const canvasRef = (
		globalThis as {
			canvas?: {
				tokens?: {
					get?: (tokenId: string) => CanvasTokenReference | null;
					placeables?: CanvasTokenReference[];
				};
			};
		}
	).canvas;

	const tokenById = canvasRef?.tokens?.get?.(targetTokenId) ?? null;
	if (tokenById) return tokenById;

	return (
		canvasRef?.tokens?.placeables?.find(
			(placeable) =>
				(placeable as TokenTargetReference).id === targetTokenId ||
				(placeable as TokenTargetReference).document?.id === targetTokenId,
		) ?? null
	);
}

export function getCurrentUserTargetTokenIds(): string[] {
	return [
		...new Set(
			Array.from(game.user?.targets ?? [])
				.map((target) =>
					normalizeOptionalString(
						(target as TokenTargetReference).id ?? (target as TokenTargetReference).document?.id,
					),
				)
				.filter((targetTokenId): targetTokenId is string => Boolean(targetTokenId)),
		),
	];
}

export function getTargetTokenName(targetTokenId: string): string {
	const normalizedTargetTokenId = normalizeOptionalString(targetTokenId);
	if (!normalizedTargetTokenId) return 'Unknown Target';

	const selectedTargetMatch = getUserTargetMatches(normalizedTargetTokenId);
	const selectedName =
		normalizeOptionalString(selectedTargetMatch?.name) ??
		normalizeOptionalString(selectedTargetMatch?.document?.name);
	if (selectedName) return selectedName;

	const canvasTokenMatch = getCanvasTokenMatches(normalizedTargetTokenId);
	return (
		normalizeOptionalString(canvasTokenMatch?.name) ??
		normalizeOptionalString(canvasTokenMatch?.document?.name) ??
		'Unknown Target'
	);
}

export function getTargetTokenUuid(targetTokenId: string): string | null {
	const normalizedTargetTokenId = normalizeOptionalString(targetTokenId);
	if (!normalizedTargetTokenId) return null;

	const selectedTargetMatch = getUserTargetMatches(normalizedTargetTokenId);
	const selectedUuid =
		normalizeOptionalString(selectedTargetMatch?.document?.uuid) ??
		normalizeOptionalString(selectedTargetMatch?.uuid);
	if (selectedUuid) return selectedUuid;

	const canvasTokenMatch = getCanvasTokenMatches(normalizedTargetTokenId);
	return normalizeOptionalString(canvasTokenMatch?.document?.uuid);
}
