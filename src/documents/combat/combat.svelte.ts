import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';
import {
	canCurrentUserReorderCombatant,
	getCombatantTypePriority,
} from '../../utils/combatantOrdering.js';
import { isCombatantDead } from '../../utils/isCombatantDead.js';
import { handleInitiativeRules } from './handleInitiativeRules.js';

/** Combatant system data with actions */
interface CombatantSystemWithActions {
	actions: {
		base: {
			current: number;
			max: number;
		};
	};
}

function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number((combatant.system as unknown as { sort?: number }).sort ?? 0);
}

function getSourceSortValueForDrop(
	source: Combatant.Implementation,
	target: Combatant.Implementation,
	siblings: Combatant.Implementation[],
	sortBefore: boolean,
): number | null {
	const targetIndex = siblings.findIndex((combatant) => combatant.id === target.id);
	if (targetIndex < 0) return null;

	const insertIndex = sortBefore ? targetIndex : targetIndex + 1;
	const previous = insertIndex > 0 ? siblings[insertIndex - 1] : null;
	const next = insertIndex < siblings.length ? siblings[insertIndex] : null;

	if (previous && next) {
		const previousSort = getCombatantManualSortValue(previous);
		const nextSort = getCombatantManualSortValue(next);
		if (previousSort === nextSort) {
			return previousSort + (sortBefore ? -0.5 : 0.5);
		}
		return previousSort + (nextSort - previousSort) / 2;
	}

	if (previous) return getCombatantManualSortValue(previous) + 1;
	if (next) return getCombatantManualSortValue(next) - 1;

	return getCombatantManualSortValue(source);
}

class NimbleCombat extends Combat {
	#subscribe: ReturnType<typeof createSubscriber>;

	#syncTurnIndexWithAliveTurns() {
		const currentCombatantId =
			typeof this.turn === 'number' && this.turn >= 0 && this.turn < this.turns.length
				? (this.turns[this.turn]?.id ?? null)
				: (this.combatant?.id ?? null);

		const aliveTurns = this.setupTurns();
		this.turns = aliveTurns;

		if (aliveTurns.length === 0) {
			this.turn = 0;
			return;
		}

		if (currentCombatantId) {
			const matchedIndex = aliveTurns.findIndex((combatant) => combatant.id === currentCombatantId);
			if (matchedIndex >= 0) {
				this.turn = matchedIndex;
				return;
			}
		}

		const currentTurn = Number.isInteger(this.turn) ? Number(this.turn) : 0;
		this.turn = Math.min(Math.max(currentTurn, 0), aliveTurns.length - 1);
	}
	constructor(
		data?: Combat.CreateData,
		context?: foundry.abstract.Document.ConstructionContext<Combat.Parent>,
	) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateCombat = Hooks.on('updateCombat', (combat) => {
				if (combat.id === this.id) update();
			});

			const combatantHooks = ['create', 'delete', 'update'].reduce(
				(hooks, hookType) => {
					const hookName = `${hookType}Combatant` as
						| 'createCombatant'
						| 'deleteCombatant'
						| 'updateCombatant';
					hooks[hookType] = Hooks.on(hookName, (combatant, _, options) => {
						if ((options as { diff?: boolean }).diff === false) return;
						if (combatant.parent?.id === this.id) update();
					});

					return hooks;
				},
				{} as Record<string, number>,
			);

			return () => {
				Hooks.off('updateCombat', updateCombat);
				Hooks.off('createCombatant', combatantHooks.create);
				Hooks.off('deleteCombatant', combatantHooks.delete);
				Hooks.off('updateCombatant', combatantHooks.update);
			};
		});
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	override async startCombat(): Promise<this> {
		const result = await super.startCombat();

		// Roll initiative for any unrolled combatants
		const sceneId = this.scene?.id;
		if (!sceneId) return result;

		const unrolled = this.combatants.filter(
			(c) => c.initiative === null && c.type === 'character' && c.sceneId === sceneId,
		);
		if (unrolled.length > 0) {
			await this.rollInitiative(
				unrolled.map((c) => c.id).filter((id): id is string => id !== null),
				{ updateTurn: false },
			);
		}

		// Initialize actions for non-character combatants (NPCs, minions, solo monsters)
		// Characters get their actions set during initiative roll
		type CombatantUpdate = { _id: string | null; 'system.actions.base.current': number };
		const npcUpdates = this.combatants.reduce<CombatantUpdate[]>((updates, combatant) => {
			if (combatant.type !== 'character') {
				const system = combatant.system as unknown as CombatantSystemWithActions;
				updates.push({
					_id: combatant.id,
					'system.actions.base.current': system.actions.base.max,
				});
			}
			return updates;
		}, []);

		if (npcUpdates.length > 0) {
			await this.updateEmbeddedDocuments('Combatant', npcUpdates);
		}

		// After start + auto-roll updates, always begin on the top player card.
		// This preserves pre-combat manual ordering as the first-turn source of truth.
		this.turns = this.setupTurns();
		if (this.turns.length > 0) {
			const firstCharacterTurnIndex = this.turns.findIndex(
				(combatant) => combatant.type === 'character',
			);
			const nextTurnIndex = firstCharacterTurnIndex >= 0 ? firstCharacterTurnIndex : 0;
			await this.update({ turn: nextTurnIndex });
		}

		return result;
	}

	override async _onEndTurn(combatant: Combatant.Implementation, context: Combat.TurnEventContext) {
		await super._onEndTurn(combatant, context);

		if (combatant.type === 'character') {
			const system = combatant.system as unknown as CombatantSystemWithActions;
			await combatant.update({
				'system.actions.base.current': system.actions.base.max,
			} as Record<string, unknown>);
		}
	}

	override async _onEndRound() {
		type CombatantUpdate = { _id: string | null; 'system.actions.base.current': number };

		// Reset only non-character combatants' actions at end of round
		// (Characters refresh their actions at end of their turn via _onEndTurn)
		const updates = this.combatants.reduce<CombatantUpdate[]>((updates, currentCombatant) => {
			if (currentCombatant.type !== 'character') {
				const system = currentCombatant.system as unknown as CombatantSystemWithActions;
				updates.push({
					_id: currentCombatant.id,
					'system.actions.base.current': system.actions.base.max,
				});
			}
			return updates;
		}, []);

		if (updates.length > 0) {
			await this.updateEmbeddedDocuments('Combatant', updates);
		}
	}

	async updateCombatant(
		combatantID: string,
		updates: Record<string, any>,
	): Promise<NimbleCombatant | undefined> {
		const combatant = this.combatants.get(combatantID) as NimbleCombatant | null;

		if (!combatant) {
			// eslint-disable-next-line no-console
			console.error(
				`Attempted to update combatant with id ${combatantID}, but the combatant could not be found.`,
			);
			return undefined;
		}

		return combatant.update(updates);
	}

	override async rollInitiative(
		ids: string | string[],
		options?: Combat.InitiativeOptions & { rollOptions?: Record<string, unknown> },
	): Promise<this> {
		const { formula = null, updateTurn = true, messageOptions = {} } = options ?? {};

		// Structure Input data
		const combatantIds = typeof ids === 'string' ? [ids] : ids;
		const currentId = this.combatant?.id;
		const chatRollMode = game.settings.get('core', 'rollMode');

		// Iterate over Combatants, performing an initiative roll for each
		const updates: Record<string, unknown>[] = [];
		const combatManaUpdates: Promise<unknown>[] = [];
		const messages: ChatMessage.CreateData[] = [];

		for await (const [i, id] of combatantIds.entries()) {
			// Get Combatant data (non-strictly)
			const combatant = this.combatants.get(id);
			const combatantUpdates: Record<string, unknown> = { _id: id };
			if (!combatant?.isOwner) continue;

			// Produce an initiative roll for the Combatant
			const roll = combatant.getInitiativeRoll(formula ?? undefined);
			await roll.evaluate();
			combatantUpdates.initiative = roll.total ?? 0;

			if (combatant.type === 'character') {
				const actionPath = 'system.actions.base.current';
				const total = roll.total ?? 0;

				if (total >= 20) combatantUpdates[actionPath] = 3;
				else if (total >= 10) combatantUpdates[actionPath] = 2;
				else combatantUpdates[actionPath] = 1;
			}

			await handleInitiativeRules({
				combatId: this.id,
				combatManaUpdates,
				combatant,
			});

			updates.push(combatantUpdates);

			// Construct chat message data
			const messageData = foundry.utils.mergeObject(
				{
					speaker: ChatMessage.getSpeaker({
						actor: combatant.actor,
						token: combatant.token,
						alias: combatant.name ?? undefined,
					}),
					flavor: game.i18n.format('COMBAT.RollsInitiative', { name: combatant.name ?? '' }),
					flags: { 'core.initiativeRoll': true },
				},
				messageOptions,
			) as ChatMessage.CreateData;
			const chatData = (await roll.toMessage(messageData, {
				create: false,
			})) as ChatMessage.CreateData & {
				rollMode?: string | null;
				sound?: string | null;
			};

			// If the combatant is hidden, use a private roll unless an alternative rollMode
			// was explicitly requested
			const msgOpts = messageOptions as ChatMessage.CreateData & { rollMode?: string };
			chatData.rollMode =
				'rollMode' in msgOpts
					? (msgOpts.rollMode ?? undefined)
					: combatant.hidden
						? CONST.DICE_ROLL_MODES.PRIVATE
						: chatRollMode;

			// Play 1 sound for the whole rolled set
			if (i > 0) chatData.sound = null;
			messages.push(chatData);
		}

		// Update multiple combatants
		await this.updateEmbeddedDocuments('Combatant', updates);

		if (combatManaUpdates.length > 0) {
			await Promise.all(combatManaUpdates);
		}

		// Ensure the turn order remains with the same combatant
		if (updateTurn && currentId) {
			await this.update({ turn: this.turns.findIndex((t) => t.id === currentId) });
		}

		// Create multiple chat messages
		await ChatMessage.implementation.create(messages);
		return this;
	}

	override setupTurns(): Combatant.Implementation[] {
		const turns = super.setupTurns();
		return turns.filter((combatant) => !isCombatantDead(combatant));
	}

	override async nextTurn(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const result = (await super.nextTurn()) as this;
		this.#syncTurnIndexWithAliveTurns();
		return result;
	}

	override async nextRound(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const result = (await super.nextRound()) as this;
		this.#syncTurnIndexWithAliveTurns();
		return result;
	}

	override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
		const typePriorityDiff = getCombatantTypePriority(a) - getCombatantTypePriority(b);
		if (typePriorityDiff !== 0) return typePriorityDiff;

		const deadStateDiff = Number(isCombatantDead(a)) - Number(isCombatantDead(b));
		if (deadStateDiff !== 0) return deadStateDiff;

		const sa = getCombatantManualSortValue(a);
		const sb = getCombatantManualSortValue(b);
		const manualSortDiff = sa - sb;
		if (manualSortDiff !== 0) return manualSortDiff;

		const initiativeA = Number(a.initiative ?? Number.NEGATIVE_INFINITY);
		const initiativeB = Number(b.initiative ?? Number.NEGATIVE_INFINITY);
		const initiativeDiff = initiativeB - initiativeA;
		if (initiativeDiff !== 0) return initiativeDiff;

		return (a.name ?? '').localeCompare(b.name ?? '');
	}

	async _onDrop(event: DragEvent & { target: EventTarget & HTMLElement }) {
		event.preventDefault();

		const trackerListElement = (event.target as HTMLElement).closest<HTMLElement>(
			'.nimble-combatants',
		);
		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(
			event,
		) as unknown as Record<string, string>;

		const { combatants } = this;

		let source = fromUuidSync(
			dropData.uuid as `Combatant.${string}`,
		) as Combatant.Implementation | null;
		if (!source && trackerListElement?.dataset.dragSourceId) {
			source = combatants.get(trackerListElement.dataset.dragSourceId) ?? null;
		}

		if (!source) return false;
		if (source.parent?.id !== this.id) return false;
		if (isCombatantDead(source)) return false;
		if (!canCurrentUserReorderCombatant(source)) return false;

		let dropTarget = (event.target as HTMLElement).closest<HTMLElement>('[data-combatant-id]');
		let target = dropTarget ? combatants.get(dropTarget.dataset.combatantId ?? '') : null;
		let sortBefore: boolean | null = null;

		if (target && dropTarget) {
			sortBefore =
				event.y <
				dropTarget.getBoundingClientRect().top + dropTarget.getBoundingClientRect().height / 2;
		}

		if (!target && trackerListElement?.dataset.dropTargetId) {
			target = combatants.get(trackerListElement.dataset.dropTargetId) ?? null;
			if (target) {
				dropTarget = trackerListElement.querySelector<HTMLElement>(
					`[data-combatant-id="${target.id}"]`,
				);
				sortBefore = trackerListElement.dataset.dropBefore === 'true';
			}
		}

		if (!target) return false;
		if (isCombatantDead(target)) return false;

		const sourceTypePriority = getCombatantTypePriority(source);
		const targetTypePriority = getCombatantTypePriority(target);
		if (sourceTypePriority !== targetTypePriority) return false;

		if (source.id === target.id) return false;

		const siblings = this.turns.filter(
			(c) =>
				c.id !== source.id &&
				!isCombatantDead(c) &&
				getCombatantTypePriority(c) === sourceTypePriority,
		);
		if (sortBefore === null) return false;

		if (game.user?.isGM) {
			// Perform the sort with full integer normalization for GM reorders.
			type SortableCombatant = Combatant.Implementation & { id: string };
			const sortUpdates = SortingHelpers.performIntegerSort(source as SortableCombatant, {
				target: target as SortableCombatant | null,
				siblings: siblings as SortableCombatant[],
				sortKey: 'system.sort',
				sortBefore,
			});

			const updateData = sortUpdates.map((u) => {
				const { update } = u;
				return {
					...update,
					_id: u.target.id,
				};
			});

			const updates = await this.updateEmbeddedDocuments('Combatant', updateData);
			this.turns = this.setupTurns();

			return updates;
		}

		// Non-GM owners can reorder their own character card by updating only their card's sort value.
		const newSortValue = getSourceSortValueForDrop(source, target, siblings, sortBefore);
		if (newSortValue === null || !Number.isFinite(newSortValue)) return false;

		const updated = await source.update({ 'system.sort': newSortValue } as Record<string, unknown>);
		this.turns = this.setupTurns();
		return updated ? [updated] : [];
	}
}

export { NimbleCombat };
