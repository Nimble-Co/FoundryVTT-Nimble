interface InitiativeRollLockData {
	requestId: string;
	userId: string | null;
	startedAt: number;
}

const INITIATIVE_ROLL_LOCK_PATH = 'flags.nimble.initiativeRollLock';
const INITIATIVE_ROLL_LOCK_TIMEOUT_MS = 15_000;

function normalizeInitiativeRollLockData(value: unknown): InitiativeRollLockData | null {
	if (!value || typeof value !== 'object') return null;

	const valueAsRecord = value as Record<string, unknown>;
	const requestId = typeof valueAsRecord.requestId === 'string' ? valueAsRecord.requestId : '';
	if (requestId.length < 1) return null;

	const startedAt =
		typeof valueAsRecord.startedAt === 'number' ? valueAsRecord.startedAt : Number.NaN;
	if (!Number.isFinite(startedAt)) return null;

	const userId = typeof valueAsRecord.userId === 'string' ? valueAsRecord.userId : null;
	return {
		requestId,
		userId,
		startedAt,
	};
}

function getInitiativeRollLockData(
	combatant: { flags?: Record<string, unknown> } | null | undefined,
): InitiativeRollLockData | null {
	return normalizeInitiativeRollLockData(
		foundry.utils.getProperty(combatant ?? {}, INITIATIVE_ROLL_LOCK_PATH),
	);
}

function isInitiativeRollLockStale(lockData: InitiativeRollLockData): boolean {
	return Date.now() - lockData.startedAt >= INITIATIVE_ROLL_LOCK_TIMEOUT_MS;
}

function hasActiveInitiativeRollLock(
	combatant: { flags?: Record<string, unknown> } | null | undefined,
): boolean {
	const lockData = getInitiativeRollLockData(combatant);
	if (!lockData) return false;
	return !isInitiativeRollLockStale(lockData);
}

function doesInitiativeRollLockMatch(
	combatant: { flags?: Record<string, unknown> } | null | undefined,
	requestId: string,
): boolean {
	const lockData = getInitiativeRollLockData(combatant);
	if (!lockData) return false;
	if (isInitiativeRollLockStale(lockData)) return false;
	return lockData.requestId === requestId;
}

function createInitiativeRollLockData(): InitiativeRollLockData {
	return {
		requestId: foundry.utils.randomID(),
		userId: game.user?.id ?? null,
		startedAt: Date.now(),
	};
}

export const initiativeRollLock = {
	path: INITIATIVE_ROLL_LOCK_PATH,
	create: createInitiativeRollLockData,
	get: getInitiativeRollLockData,
	isStale: isInitiativeRollLockStale,
	hasActiveLock: hasActiveInitiativeRollLock,
	matches: doesInitiativeRollLockMatch,
};
