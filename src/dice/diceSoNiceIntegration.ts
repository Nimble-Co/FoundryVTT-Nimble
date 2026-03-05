/**
 * Dice So Nice integration utilities.
 *
 * Provides functions to interact with the Dice So Nice module for
 * position-based dice selection and animation coordination.
 *
 * Uses the official DSN Events API when available for reliable access to dice data.
 * See: https://gitlab.com/riccisi/foundryvtt-dice-so-nice/-/wikis/API/Events
 */

/**
 * Represents a die with its screen position after DSN animation.
 */
interface DieWithPosition {
	/** The result value shown on the die */
	result: number;
	/** The index of this die in the original roll */
	index: number;
	/** X coordinate on screen (left to right) */
	x: number;
	/** Y coordinate on screen (top to bottom) */
	y: number;
	/** Z coordinate (height) */
	z: number;
}

/**
 * DSN dice event data from the Events API.
 * @internal Reserved for future use with DSN Events API
 */
interface _DSNDiceEvent {
	dice: {
		result: number;
		position?: { x: number; y: number; z: number };
		getWorldPosition?: () => { x: number; y: number; z: number };
	};
	position?: { x: number; y: number; z: number };
}

/**
 * Latest dice results from DSN RESULT events.
 * Cleared when a new roll starts.
 * @internal Reserved for future use with DSN Events API
 */
const _latestDiceResults: DieWithPosition[] = [];

/**
 * Checks if Dice So Nice module is active.
 */
function isDiceSoNiceActive(): boolean {
	return game.modules?.get('dice-so-nice')?.active ?? false;
}

/**
 * Gets the Dice So Nice dice3d instance.
 */
function getDice3D():
	| {
			box?: { diceList?: unknown[] };
			waitFor3DAnimationByMessageId?: (id: string) => Promise<void>;
			addSystem?: (system: unknown) => void;
	  }
	| undefined {
	return (
		game as unknown as {
			dice3d?: {
				box?: { diceList?: unknown[] };
				waitFor3DAnimationByMessageId?: (id: string) => Promise<void>;
				addSystem?: (system: unknown) => void;
			};
		}
	).dice3d;
}

/**
 * Waits for Dice So Nice animation to complete for a given message.
 *
 * @param messageId - The chat message ID associated with the roll
 * @returns Promise that resolves when animation completes
 */
async function waitForDSNAnimation(messageId: string): Promise<void> {
	const dice3d = getDice3D();
	if (dice3d?.waitFor3DAnimationByMessageId) {
		await dice3d.waitFor3DAnimationByMessageId(messageId);
	}
}

/**
 * Gets the positions of all dice from the last DSN roll.
 *
 * NOTE: This accesses internal DSN APIs that may change between versions.
 * Use with caution and test after DSN updates.
 *
 * @returns Array of dice with their positions, sorted by x coordinate (leftmost first)
 */
function getDicePositions(): DieWithPosition[] {
	const dice3d = getDice3D();
	const diceBox = dice3d?.box;

	console.log(
		'[DSN Integration] getDicePositions called',
		JSON.stringify({
			dice3dExists: !!dice3d,
			diceBoxExists: !!diceBox,
			diceListExists: !!diceBox?.diceList,
			diceListLength: diceBox?.diceList?.length ?? 0,
		}),
	);

	if (!diceBox?.diceList || !Array.isArray(diceBox.diceList)) {
		console.log('[DSN Integration] getDicePositions: No dice list available');
		return [];
	}

	const diceWithPositions: DieWithPosition[] = [];

	for (let i = 0; i < diceBox.diceList.length; i++) {
		const diceData = diceBox.diceList[i] as {
			parent?: { position?: { x: number; y: number; z: number } };
			getUpsideValue?: () => number;
			result?: number;
		};

		if (!diceData?.parent?.position) {
			console.log(
				`[DSN Integration] getDicePositions: Die ${i} has no position data`,
				JSON.stringify({
					hasParent: !!diceData?.parent,
					hasPosition: !!diceData?.parent?.position,
				}),
			);
			continue;
		}

		const result = diceData.getUpsideValue?.() ?? diceData.result ?? 0;
		const { x, y, z } = diceData.parent.position;

		console.log(
			`[DSN Integration] getDicePositions: Die ${i}`,
			JSON.stringify({
				result,
				x: x.toFixed(2),
				y: y.toFixed(2),
				z: z.toFixed(2),
			}),
		);

		diceWithPositions.push({
			result,
			index: i,
			x,
			y,
			z,
		});
	}

	// Sort by x coordinate (leftmost first)
	diceWithPositions.sort((a, b) => a.x - b.x);

	console.log(
		'[DSN Integration] getDicePositions complete',
		JSON.stringify({
			totalDice: diceWithPositions.length,
			sortedByX: diceWithPositions.map((d) => ({
				index: d.index,
				result: d.result,
				x: d.x.toFixed(2),
			})),
		}),
	);

	return diceWithPositions;
}

/**
 * Gets the leftmost die from the last DSN roll.
 *
 * @returns The leftmost die with its position, or undefined if no dice found
 */
function getLeftmostDie(): DieWithPosition | undefined {
	const positions = getDicePositions();
	return positions[0];
}

/**
 * Registers a hook to capture dice positions when a roll completes.
 *
 * @param callback - Function called with dice positions when roll completes
 * @returns Hook ID that can be used to unregister the hook
 */
function onRollComplete(
	callback: (messageId: string, positions: DieWithPosition[]) => void,
): number {
	return Hooks.on('diceSoNiceRollComplete', (messageId: string) => {
		const positions = getDicePositions();
		callback(messageId, positions);
	});
}

/**
 * Randomly selects indices from an array of dice.
 * Used as fallback when DSN is not available.
 *
 * @param totalDice - Total number of dice rolled
 * @param keepCount - How many dice to select
 * @returns Array of randomly selected indices
 */
function selectRandomIndices(totalDice: number, keepCount: number): number[] {
	if (keepCount >= totalDice) {
		return Array.from({ length: totalDice }, (_, i) => i);
	}

	const indices: number[] = [];
	const available = Array.from({ length: totalDice }, (_, i) => i);

	for (let i = 0; i < keepCount; i++) {
		const randomIndex = Math.floor(Math.random() * available.length);
		indices.push(available[randomIndex]);
		available.splice(randomIndex, 1);
	}

	return indices;
}

/**
 * Selects which die result to use as the "primary" based on screen position.
 *
 * When rolling with advantage/disadvantage, instead of keeping the highest/lowest
 * value, this selects based on the leftmost die position on screen.
 *
 * When DSN is not available, falls back to random selection.
 *
 * @param results - Array of die results from the roll
 * @param keepCount - How many dice to keep (usually 1)
 * @param messageId - The chat message ID to wait for DSN animation
 * @returns Promise resolving to indices of dice to keep (leftmost ones, or random if no DSN)
 */
async function selectByPosition(
	results: { result: number; active: boolean; discarded: boolean }[],
	keepCount: number,
	messageId?: string,
): Promise<number[]> {
	// If DSN isn't active, fall back to random selection
	if (!isDiceSoNiceActive()) {
		const selectedIndices = selectRandomIndices(results.length, keepCount);
		console.log('[DSN Integration] DSN not active, using random selection:', selectedIndices);
		return selectedIndices;
	}

	// Wait for animation to complete if we have a message ID
	if (messageId) {
		await waitForDSNAnimation(messageId);
	}

	// Get positions and return the leftmost dice indices
	const positions = getDicePositions();
	if (positions.length === 0) {
		// Fallback to random if no positions available
		const selectedIndices = selectRandomIndices(results.length, keepCount);
		console.log(
			'[DSN Integration] No DSN positions available, using random selection:',
			selectedIndices,
		);
		return selectedIndices;
	}

	// Return the indices of the leftmost dice
	return positions.slice(0, keepCount).map((d) => d.index);
}

/**
 * Pending position selections waiting for DSN animation to complete.
 * Maps message ID to the roll and callback for updating the chat message.
 */
const pendingPositionSelections = new Map<
	string,
	{
		roll: unknown;
		updateCallback: (result: {
			isCritical: boolean;
			isMiss: boolean;
			total: number;
			selectedDieIndex: number;
			selectedDieResult: number;
		}) => Promise<void>;
	}
>();

/**
 * Registers a roll for position-based selection after DSN animation completes.
 *
 * @param messageId - The chat message ID
 * @param roll - The DamageRoll instance
 * @param updateCallback - Callback to update the chat message with the result
 */
function registerForPositionSelection(
	messageId: string,
	roll: unknown,
	updateCallback: (result: {
		isCritical: boolean;
		isMiss: boolean;
		total: number;
		selectedDieIndex: number;
		selectedDieResult: number;
	}) => Promise<void>,
): void {
	pendingPositionSelections.set(messageId, { roll, updateCallback });
	console.log(`[DSN Integration] Registered position selection for message ${messageId}`);
}

/**
 * Initializes the DSN position-based selection hook.
 * Call this once during system initialization.
 */
function initPositionSelectionHook(): void {
	if (!isDiceSoNiceActive()) {
		console.log('[DSN Integration] Dice So Nice not active, skipping position selection hook');
		return;
	}

	Hooks.on('diceSoNiceRollComplete', (messageId: string) => {
		const pending = pendingPositionSelections.get(messageId);
		if (!pending) return;

		console.log(`[DSN Integration] Processing position selection for message ${messageId}`);
		pendingPositionSelections.delete(messageId);

		// Get dice positions
		const positions = getDicePositions();
		if (positions.length === 0) {
			console.warn('[DSN Integration] No dice positions available');
			return;
		}

		// Apply position-based selection
		const roll = pending.roll as {
			applyPositionBasedSelection?: (positions: DieWithPosition[]) => {
				isCritical: boolean;
				isMiss: boolean;
				total: number;
				selectedDieIndex: number;
				selectedDieResult: number;
			};
		};

		if (typeof roll.applyPositionBasedSelection === 'function') {
			const result = roll.applyPositionBasedSelection(positions);
			console.log('[DSN Integration] Position selection result:', result);

			// Call the update callback to persist changes
			pending.updateCallback(result).catch((err) => {
				console.error('[DSN Integration] Failed to update chat message:', err);
			});
		}
	});

	console.log('[DSN Integration] Position selection hook initialized');
}

export {
	type DieWithPosition,
	getDice3D,
	getDicePositions,
	getLeftmostDie,
	initPositionSelectionHook,
	isDiceSoNiceActive,
	onRollComplete,
	registerForPositionSelection,
	selectByPosition,
	selectRandomIndices,
	waitForDSNAnimation,
};
