import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';

/** Combatant system data with actions */
interface CombatantSystemWithActions {
	actions: {
		base: {
			current: number;
			max: number;
		};
	};
}

class NimbleCombat extends Combat {
	#subscribe: ReturnType<typeof createSubscriber>;

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
		const unrolled = this.combatants.filter((c) => c.initiative === null && c.type === 'character');
		if (unrolled.length > 0) {
			await this.rollInitiative(
				unrolled.map((c) => c.id).filter((id): id is string => id !== null),
				{ updateTurn: false },
			);
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
		} else if (combatant.type === 'soloMonster') {
			console.log('SOLO MONSTER');
		}
	}

	override async _onEndRound() {
		// If it's the first turn of the first round, don't reset actions
		if (this.round === 1 && this.turn === 0) {
			return;
		}

		const skippedCombatants = this.turns.slice(this.previous?.turn ?? 0);

		type CombatantUpdate = { _id: string | null; 'system.actions.base.current': number };
		await this.updateEmbeddedDocuments(
			'Combatant',
			skippedCombatants.reduce<CombatantUpdate[]>((updates, currentCombatant) => {
				if (currentCombatant.type === 'character') {
					const system = currentCombatant.system as unknown as CombatantSystemWithActions;
					updates.push({
						_id: currentCombatant.id,
						'system.actions.base.current': system.actions.base.max,
					});
				}
				return updates;
			}, []),
		);
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
		const messages: ChatMessage.CreateData[] = [];

		for await (const [i, id] of combatantIds.entries()) {
			// Get Combatant data (non-strictly)
			const combatant = this.combatants.get(id);
			const combatantUpdates: Record<string, unknown> = { _id: id, initiative: 0 };
			if (!combatant?.isOwner) continue;

			// Produce an initiative roll for the Combatant
			const roll = combatant.getInitiativeRoll(formula ?? undefined);
			await roll.evaluate();

			if (combatant.type === 'character') {
				const actionPath = 'system.actions.base.current';
				const total = roll.total ?? 0;

				if (total >= 20) combatantUpdates[actionPath] = 3;
				else if (total >= 10) combatantUpdates[actionPath] = 2;
				else combatantUpdates[actionPath] = 1;
			}

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

		// Ensure the turn order remains with the same combatant
		if (updateTurn && currentId) {
			await this.update({ turn: this.turns.findIndex((t) => t.id === currentId) });
		}

		// Create multiple chat messages
		await ChatMessage.implementation.create(messages);
		return this;
	}

	override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
		const sa = (a.system as unknown as { sort: number }).sort;
		const sb = (b.system as unknown as { sort: number }).sort;

		return sa - sb;
	}

	async _onDrop(event: DragEvent & { target: EventTarget & HTMLElement }) {
		event.preventDefault();
		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(
			event,
		) as unknown as Record<string, string>;

		const { combatants } = this;

		const source = fromUuidSync<Combatant.Implementation>(dropData.uuid as `Combatant.${string}`);
		if (!source) return false;

		const dropTarget = (event.target as HTMLElement).closest<HTMLElement>('[data-combatant-id]');
		if (!dropTarget) return false;

		const target = combatants.get(dropTarget.dataset.combatantId ?? '');
		if (!target) return false;

		if (source.id === target.id) return false;

		const siblings = this.turns.filter((c) => c.id !== source.id);

		const sortBefore =
			event.y <
			dropTarget.getBoundingClientRect().top + dropTarget.getBoundingClientRect().height / 2;

		// Perform the sort
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
}

export { NimbleCombat };
