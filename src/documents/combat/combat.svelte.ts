import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';

class NimbleCombat extends Combat {
	#subscribe;

	constructor(data, context) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateCombat = Hooks.on('updateCombat', (combat) => {
				if (combat.id === this.id) update();
			});

			const combatantHooks = ['create', 'delete', 'update'].reduce(
				(hooks, hookType) => {
					hooks[hookType] = Hooks.on(`${hookType}Combatant`, (combatant, _, { diff }) => {
						if (diff === false) return;
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

	override async _onEndTurn(combatant) {
		await super._onEndTurn(combatant);

		if (combatant.type === 'character') {
			await combatant.update({
				'system.actions.base.current': combatant.system.actions.base.max,
			});
		} else if (combatant.type === 'soloMonster') {
			console.log('SOLO MONSTER');
		}
	}

	override async _onEndRound() {
		const skippedCombatants = this.turns.slice(this.previous?.turn ?? 0);

		await this.updateEmbeddedDocuments(
			'Combatant',
			skippedCombatants.reduce((updates, currentCombatant) => {
				if (currentCombatant.type === 'character') {
					// @ts-expect-error
					updates.push({
						_id: currentCombatant.id,
						'system.actions.base.current': currentCombatant.system.actions.base.max,
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
		{ formula = null, updateTurn = true, messageOptions = {}, rollOptions = {} } = {} as {
			formula: string | null;
			updateTurn: boolean;
			messageOptions: Record<string, any>;
			rollOptions: Record<string, any>;
		},
	) {
		// Structure Input data
		const combatantIds = typeof ids === 'string' ? [ids] : ids;
		const currentId = this.combatant?.id;
		const chatRollMode = game.settings.get('core', 'rollMode');

		// Iterate over Combatants, performing an initiative roll for each
		const updates: Record<string, any>[] = [];
		const messages: any[] = [];

		for await (const [i, id] of combatantIds.entries()) {
			// Get Combatant data (non-strictly)
			const combatant = this.combatants.get(id);
			const combatantUpdates = { _id: id, initiative: 0 };
			if (!combatant?.isOwner) continue;

			// Produce an initiative roll for the Combatant
			const roll = combatant.getInitiativeRoll(formula, rollOptions);
			await roll.evaluate();

			if (combatant.type === 'character') {
				const actionPath = 'system.actions.base.current';

				if (roll?.total >= 20) combatantUpdates[actionPath] = 3;
				else if (roll?.total >= 10) combatantUpdates[actionPath] = 2;
				else combatantUpdates[actionPath] = 1;
			}

			updates.push(combatantUpdates);

			// Construct chat message data
			const messageData = foundry.utils.mergeObject(
				{
					speaker: ChatMessage.getSpeaker({
						actor: combatant.actor,
						token: combatant.token,
						alias: combatant.name,
					}),
					flavor: game.i18n.format('COMBAT.RollsInitiative', { name: combatant.name }),
					flags: { 'core.initiativeRoll': true },
				},
				messageOptions,
			);
			const chatData = await roll.toMessage(messageData, { create: false });

			// If the combatant is hidden, use a private roll unless an alternative rollMode
			// was explicitly requested
			// eslint-disable-next-line no-nested-ternary
			chatData.rollMode =
				'rollMode' in messageOptions
					? messageOptions.rollMode
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

	override _sortCombatants(a, b) {
		const sa = a.system.sort;
		const sb = b.system.sort;

		return sa - sb;
	}

	async _onDrop(event: DragEvent & { target: EventTarget & HTMLElement }) {
		event.preventDefault();
		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(
			event,
		) as unknown as Record<string, string>;

		const { combatants } = this;

		const source = fromUuidSync(dropData.uuid);
		if (!source) return false;

		const dropTarget = event.target!.closest('[data-combatant-id]');
		if (!dropTarget) return false;

		const target = combatants.get(dropTarget.dataset.combatantId);

		if (source.id === target.id) return false;

		const siblings = this.turns.filter((c) => c.id !== source.id);

		const sortBefore =
			event.y <
			dropTarget.getBoundingClientRect().top + dropTarget.getBoundingClientRect().height / 2;

		// Perform the sort
		const sortUpdates = SortingHelpers.performIntegerSort(source, {
			target,
			siblings,
			sortKey: 'system.sort',
			sortBefore,
		});

		const updateData = sortUpdates.map((u) => {
			const { update } = u;
			update._id = u.target?.id;
			return update;
		});

		const updates = await this.updateEmbeddedDocuments('Combatant', updateData);
		this.turns = this.setupTurns();

		return updates;
	}
}

export { NimbleCombat };
