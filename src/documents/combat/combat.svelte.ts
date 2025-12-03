import type { NimbleCombatant } from '../combatant/combatant.svelte.js';

import { createSubscriber } from 'svelte/reactivity';

// Augment HookConfig to include Combatant document hooks
declare module 'fvtt-types/configuration' {
	interface HookConfig {
		createCombatant: [document: Combatant, options: { diff?: boolean }, userId: string];
		deleteCombatant: [document: Combatant, options: { diff?: boolean }, userId: string];
		updateCombatant: [
			document: Combatant,
			changes: Record<string, unknown>,
			options: { diff?: boolean },
			userId: string,
		];
	}
}

// Interface for combatant system with actions
interface CombatantActionsSystem {
	actions: {
		base: {
			current: number;
			max: number;
		};
	};
	sort: number;
}

class NimbleCombat extends Combat {
	#subscribe;

	constructor(data, context) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateCombat = Hooks.on('updateCombat', (combat) => {
				if (combat.id === this.id) update();
			});

			const combatantHooks = {
				create: Hooks.on('createCombatant', (combatant, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (combatant.parent?.id === this.id) update();
				}),
				delete: Hooks.on('deleteCombatant', (combatant, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (combatant.parent?.id === this.id) update();
				}),
				update: Hooks.on('updateCombatant', (combatant, _changes, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (combatant.parent?.id === this.id) update();
				}),
			};

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

	protected override async _onEndTurn(
		combatant: Combatant.Implementation,
		context: Combat.TurnEventContext,
	): Promise<void> {
		await super._onEndTurn(combatant, context);

		if (combatant.type === 'character') {
			const combatantSystem = combatant.system as unknown as CombatantActionsSystem;
			await combatant.update({
				'system.actions.base.current': combatantSystem.actions.base.max,
			} as Record<string, unknown>);
		} else if (combatant.type === 'soloMonster') {
			console.log('SOLO MONSTER');
		}
	}

	override async _onEndRound(): Promise<void> {
		const skippedCombatants = this.turns.slice(this.previous?.turn ?? 0);

		const updates: Record<string, unknown>[] = [];
		for (const currentCombatant of skippedCombatants) {
			if (currentCombatant.type === 'character') {
				const combatantSystem = currentCombatant.system as unknown as CombatantActionsSystem;
				updates.push({
					_id: currentCombatant.id,
					'system.actions.base.current': combatantSystem.actions.base.max,
				});
			}
		}

		await this.updateEmbeddedDocuments('Combatant', updates as Combatant.UpdateData[]);
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
		options?: Combat.InitiativeOptions,
	): Promise<this> {
		const { formula, updateTurn = true, messageOptions = {} } = options ?? {};
		const messageOpts = messageOptions as Record<string, unknown> & { rollMode?: string };
		// Structure Input data
		const idArray = typeof ids === 'string' ? [ids] : ids;
		const currentId = this.combatant?.id;
		const chatRollMode = game.settings.get('core', 'rollMode');

		// Iterate over Combatants, performing an initiative roll for each
		const updates: Record<string, unknown>[] = [];
		const messages: Record<string, unknown>[] = [];

		for await (const [i, id] of idArray.entries()) {
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
						alias: combatant.name ?? '',
					}),
					flavor: game.i18n.format('COMBAT.RollsInitiative', { name: combatant.name ?? '' }),
					flags: { 'core.initiativeRoll': true },
				},
				messageOpts,
			);
			const chatData = (await roll.toMessage(messageData as ChatMessage.CreateData, {
				create: false,
			})) as Record<string, unknown>;

			// If the combatant is hidden, use a private roll unless an alternative rollMode
			// was explicitly requested
			// eslint-disable-next-line no-nested-ternary
			(chatData as Record<string, unknown>).rollMode =
				'rollMode' in messageOpts
					? messageOpts.rollMode
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

	override _sortCombatants(a: Combatant, b: Combatant): number {
		const aSystem = a.system as unknown as CombatantActionsSystem;
		const bSystem = b.system as unknown as CombatantActionsSystem;
		const sa = aSystem.sort;
		const sb = bSystem.sort;

		return sa - sb;
	}

	async _onDrop(
		event: DragEvent & { target: EventTarget & HTMLElement },
	): Promise<Combatant[] | false> {
		event.preventDefault();
		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(
			event,
		) as unknown as Record<string, string>;

		const { combatants } = this;

		const source = fromUuidSync(dropData.uuid as `Combatant.${string}`);
		if (!source) return false;

		const dropTarget = event.target.closest('[data-combatant-id]') as HTMLElement | null;
		if (!dropTarget) return false;

		const target = combatants.get(dropTarget.dataset.combatantId ?? '');

		if (!target || source.id === target.id) return false;

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
			const update = u.update as Record<string, unknown>;
			update._id = u.target?.id;
			return update;
		});

		const updates = await this.updateEmbeddedDocuments(
			'Combatant',
			updateData as Combatant.UpdateData[],
		);
		this.turns = this.setupTurns();

		return updates ?? [];
	}
}

export { NimbleCombat };
