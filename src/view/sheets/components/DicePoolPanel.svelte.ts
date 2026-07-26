import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { systemHookName } from '#system';
import { addBankedDamageReduction } from '#utils/bankedDamageReduction.js';
import { adjustPool } from '#utils/chargePool/chargePoolRecover.js';
import { type DicePoolConsumer, getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { dieSizeToMaxFace, resolveFormulaToInteger } from '#utils/dicePool/helpers.js';
import type { DicePoolState, DieSize } from '#utils/dicePool/types.js';
import localize from '#utils/localize.ts';
import type { LivePoolView } from './DicePoolTracker.svelte.ts';

// Reactive subscription so the panel reflects pool mutations made by other
// surfaces (sheet edits, chat-card triggered refills, GM tools) while open.
const PANEL_HOOK_NAMES = [
	systemHookName('dicePool.changed'),
	systemHookName('dicePool.refilled'),
	systemHookName('chargePool.changed'),
	systemHookName('chargePool.recovered'),
	'updateItem',
	'createItem',
	'deleteItem',
	'updateActor',
] as const;

function registerPanelHooks(listener: () => void): () => void {
	const hooksApi = Hooks as unknown as {
		on: (hook: string, listener: () => void) => number;
		off: (hook: string, id: number) => void;
	};
	const ids = PANEL_HOOK_NAMES.map((name) => ({ name, id: hooksApi.on(name, listener) }));
	return () => {
		for (const { name, id } of ids) hooksApi.off(name, id);
	};
}

function consumerKey(consumer: DicePoolConsumer): string {
	return `${consumer.itemId}:${consumer.ruleId}`;
}

function substituteFormula(formula: string, count: number, sum: number): string {
	return formula.replace(/@n\b/g, String(count)).replace(/@sum\b/g, String(sum));
}

export function createDicePoolPanelState(
	getActor: () => NimbleCharacter,
	getPool: () => LivePoolView,
) {
	const subscribePanel = createSubscriber(registerPanelHooks);

	// Live pool snapshot — re-derived from the actor each time hooks fire so
	// edits via other UI surfaces stay in sync.
	const livePool = $derived.by((): LivePoolView | null => {
		subscribePanel();
		const view = getPool();
		if (view.kind === 'count') return view;

		const found = getDicePools(getActor()).find((p) => p.id === view.id) as
			| DicePoolState
			| undefined;
		if (!found) return null;
		const total = found.faces.reduce((sum, face) => sum + face, 0);
		return {
			kind: 'rolled',
			id: found.id,
			identifier: found.identifier,
			label: found.label,
			dieSize: found.dieSize,
			max: found.max,
			faces: [...found.faces],
			total,
			hasConsumers: view.hasConsumers,
		};
	});

	const consumers = $derived.by((): DicePoolConsumer[] => {
		const pool = livePool;
		if (!pool || pool.kind !== 'rolled') return [];
		// Re-look-up to get full DicePoolState (consumers helper wants .scope etc).
		const fullPool = getDicePools(getActor()).find((p) => p.id === pool.id);
		if (!fullPool) return [];
		return getDicePoolConsumers(getActor(), fullPool);
	});

	let selectedIndices = $state<Set<number>>(new Set());
	let selectedConsumerKey = $state<string | null>(null);
	let livePreviewTotal = $state<number | null>(null);

	const selectedConsumer = $derived.by((): DicePoolConsumer | null => {
		if (!selectedConsumerKey) return null;
		return consumers.find((c) => consumerKey(c) === selectedConsumerKey) ?? null;
	});

	const selectedFaces = $derived.by((): number[] => {
		const pool = livePool;
		if (!pool || pool.kind !== 'rolled') return [];
		const result: number[] = [];
		for (let i = 0; i < pool.faces.length; i += 1) {
			if (selectedIndices.has(i)) result.push(pool.faces[i]);
		}
		return result;
	});

	const selectedCount = $derived(selectedFaces.length);
	const selectedSum = $derived(selectedFaces.reduce((a, b) => a + b, 0));

	/** True when the chosen dice are transformed in place rather than spent. */
	const isMaximizeOutcome = $derived(selectedConsumer?.selectionOutcome === 'maximize');

	/**
	 * How many dice the chosen consumer may act on. Transforming outcomes are
	 * capped at the consumer's cost so a "change 1 die" feature offers exactly
	 * one pick; spending outcomes stay uncapped ("expend 1 or more").
	 */
	const selectionCap = $derived.by((): number | null => {
		const consumer = selectedConsumer;
		if (!consumer || consumer.selectionOutcome === 'consume') return null;
		return Math.max(1, resolveFormulaToInteger(getActor(), consumer.cost));
	});

	/**
	 * Dice already showing their highest face cannot be raised, so they are not
	 * offered as targets for a transforming outcome.
	 */
	function canSelectDie(index: number): boolean {
		const pool = livePool;
		if (!pool || pool.kind !== 'rolled') return false;
		if (!isMaximizeOutcome) return true;
		const face = pool.faces[index];
		if (face === undefined) return false;
		return face < dieSizeToMaxFace(pool.dieSize as DieSize);
	}

	// Keep the selection within the cap when the player switches to a capped
	// consumer with more dice already picked.
	$effect(() => {
		const cap = selectionCap;
		if (cap === null || selectedIndices.size <= cap) return;
		selectedIndices = new Set([...selectedIndices].slice(-cap));
	});

	// Drop stale consumer selection if the consumer list changes such that the
	// chosen consumer disappears (e.g. its item is deleted mid-flow).
	$effect(() => {
		if (!selectedConsumerKey) return;
		const stillThere = consumers.some((c) => consumerKey(c) === selectedConsumerKey);
		if (!stillThere) {
			selectedConsumerKey = null;
			selectedIndices = new Set();
		}
	});

	// Drop selected indices that no longer point at a real die (pool may shrink
	// mid-flow if another action consumes dice).
	$effect(() => {
		const pool = livePool;
		if (!pool || pool.kind !== 'rolled') {
			if (selectedIndices.size > 0) {
				selectedIndices = new Set();
			}
			return;
		}
		const next = new Set<number>();
		for (const i of selectedIndices) {
			if (i < pool.faces.length) next.add(i);
		}
		if (next.size !== selectedIndices.size) {
			selectedIndices = next;
		}
	});

	async function evaluateEffectPreview(
		formula: string,
		count: number,
		sum: number,
	): Promise<number | null> {
		if (count < 1) return null;
		try {
			const substituted = substituteFormula(formula, count, sum);
			const RollCls = (globalThis as unknown as { Roll: typeof Roll }).Roll;
			const roll = new RollCls(substituted, getActor().getRollData());
			await roll.evaluate({ allowInteractive: false } as Parameters<Roll['evaluate']>[0]);
			return roll.total ?? null;
		} catch {
			return null;
		}
	}

	// Recompute the live preview whenever the selection or formula changes.
	$effect(() => {
		const formula = selectedConsumer?.effectFormula ?? null;
		const count = selectedCount;
		const sum = selectedSum;
		if (!formula || count < 1) {
			livePreviewTotal = null;
			return;
		}
		let cancelled = false;
		void evaluateEffectPreview(formula, count, sum).then((total) => {
			if (!cancelled) livePreviewTotal = total;
		});
		return () => {
			cancelled = true;
		};
	});

	function toggleDie(index: number): void {
		const next = new Set(selectedIndices);
		if (next.has(index)) {
			next.delete(index);
			selectedIndices = next;
			return;
		}
		if (!canSelectDie(index)) return;
		// At the cap, the oldest pick makes way for the new one, so a cap of 1
		// behaves like a radio group instead of dead-ending the player.
		const cap = selectionCap;
		if (cap !== null && next.size >= cap) {
			for (const oldest of next) {
				next.delete(oldest);
				if (next.size < cap) break;
			}
		}
		next.add(index);
		selectedIndices = next;
	}

	function selectConsumer(consumer: DicePoolConsumer): void {
		const key = consumerKey(consumer);
		selectedConsumerKey = selectedConsumerKey === key ? null : key;
	}

	/** Select a consumer by its key (itemId:ruleId). Returns false when the
	 *  consumer is not (yet) in this pool's list. */
	function selectConsumerByKey(key: string): boolean {
		if (!consumers.some((c) => consumerKey(c) === key)) return false;
		selectedConsumerKey = key;
		return true;
	}

	async function setDieValue(index: number, value: number): Promise<void> {
		const pool = livePool;
		if (!pool || pool.kind !== 'rolled') return;
		if (index < 0 || index >= pool.faces.length) return;
		const maxFace = dieSizeToMaxFace(pool.dieSize as DieSize);
		const clamped = Math.max(1, Math.min(maxFace, Math.floor(value)));
		const next = [...pool.faces];
		next[index] = clamped;
		await setPoolFaces(getActor(), pool.id, next);
	}

	async function discardDie(index: number): Promise<void> {
		const pool = livePool;
		if (!pool || pool.kind !== 'rolled') return;
		if (index < 0 || index >= pool.faces.length) return;
		const next = [...pool.faces];
		next.splice(index, 1);
		// Drop the index from selection if it was selected; later indices shift.
		const nextSelected = new Set<number>();
		for (const i of selectedIndices) {
			if (i === index) continue;
			nextSelected.add(i > index ? i - 1 : i);
		}
		selectedIndices = nextSelected;
		await setPoolFaces(getActor(), pool.id, next);
	}

	async function setChargeCurrent(value: number): Promise<void> {
		const pool = livePool;
		if (!pool || pool.kind !== 'count') return;
		const clamped = Math.max(0, Math.min(pool.max, Math.floor(value)));
		await adjustPool(getActor(), pool.id, 'set', clamped);
	}

	/** Raise every picked die to the pool's highest face, leaving the pool size
	 *  untouched, and report the before/after faces to chat. */
	async function applyMaximizeOutcome(
		pool: Extract<LivePoolView, { kind: 'rolled' }>,
		consumer: DicePoolConsumer,
	): Promise<void> {
		const maxFace = dieSizeToMaxFace(pool.dieSize as DieSize);
		const changes: string[] = [];
		const nextFaces = pool.faces.map((face, i) => {
			if (!selectedIndices.has(i) || face >= maxFace) return face;
			changes.push(`${face} → ${maxFace}`);
			return maxFace;
		});
		if (changes.length < 1) return;

		await setPoolFaces(getActor(), pool.id, nextFaces);

		const ChatMessageCls = (globalThis as unknown as { ChatMessage: typeof ChatMessage })
			.ChatMessage;
		const headerLine = `<strong>${foundry.utils.escapeHTML(consumer.itemName)}</strong>`;
		const subLine = foundry.utils.escapeHTML(
			localize('NIMBLE.dicePoolTracker.panel.useFeature.maximizedNote', {
				count: String(changes.length),
				label: pool.label,
				changes: changes.join(', '),
			}),
		);
		await ChatMessageCls.create({
			speaker: ChatMessageCls.getSpeaker({ actor: getActor() }),
			content: `${headerLine}<div class="nimble-dice-pool-spend-flavor">${subLine}</div>`,
		} as ChatMessage.CreateData);
	}

	async function spend(): Promise<void> {
		const pool = livePool;
		const consumer = selectedConsumer;
		if (!pool || pool.kind !== 'rolled' || !consumer || selectedCount < 1) return;

		if (consumer.selectionOutcome === 'maximize') {
			await applyMaximizeOutcome(pool, consumer);
			selectedIndices = new Set();
			selectedConsumerKey = null;
			livePreviewTotal = null;
			return;
		}

		const spentFaces = pool.faces.filter((_, i) => selectedIndices.has(i));
		const nextFaces = pool.faces.filter((_, i) => !selectedIndices.has(i));

		await setPoolFaces(getActor(), pool.id, nextFaces);

		const substituted = substituteFormula(
			consumer.effectFormula ?? '0',
			spentFaces.length,
			spentFaces.reduce((a, b) => a + b, 0),
		);
		const RollCls = (globalThis as unknown as { Roll: typeof Roll }).Roll;
		const effectRoll = new RollCls(substituted, getActor().getRollData());
		await effectRoll.evaluate();

		if (consumer.effectType === 'damageReduction') {
			await addBankedDamageReduction(
				getActor(),
				effectRoll.total ?? 0,
				consumer.itemImg,
				consumer.itemName,
			);
		}

		const ChatMessageCls = (globalThis as unknown as { ChatMessage: typeof ChatMessage })
			.ChatMessage;
		const speaker = ChatMessageCls.getSpeaker({ actor: getActor() });
		const headerLine = `<strong>${foundry.utils.escapeHTML(consumer.itemName)}</strong>`;
		let subLine = foundry.utils.escapeHTML(
			`Spent ${spentFaces.length} ${pool.label} (${spentFaces.join(', ')})`,
		);
		if (consumer.effectType === 'damageReduction') {
			subLine += `<br />${foundry.utils.escapeHTML(localize('NIMBLE.dicePoolTracker.panel.useFeature.bankedReductionNote'))}`;
		}
		const flavor = `${headerLine}<div class="nimble-dice-pool-spend-flavor">${subLine}</div>`;

		await effectRoll.toMessage({
			speaker,
			flavor,
		} as Parameters<Roll['toMessage']>[0]);

		// Reset selection so the panel is fresh for another spend, but keep open.
		selectedIndices = new Set();
		selectedConsumerKey = null;
		livePreviewTotal = null;
	}

	return {
		get pool() {
			return livePool;
		},
		get consumers() {
			return consumers;
		},
		get selectedIndices() {
			return selectedIndices;
		},
		get selectedConsumer() {
			return selectedConsumer;
		},
		get selectedConsumerKey() {
			return selectedConsumerKey;
		},
		get selectedCount() {
			return selectedCount;
		},
		get selectedSum() {
			return selectedSum;
		},
		get livePreviewTotal() {
			return livePreviewTotal;
		},
		get isMaximizeOutcome() {
			return isMaximizeOutcome;
		},
		canSelectDie,
		consumerKey,
		toggleDie,
		selectConsumer,
		selectConsumerByKey,
		setDieValue,
		discardDie,
		setChargeCurrent,
		spend,
	};
}
