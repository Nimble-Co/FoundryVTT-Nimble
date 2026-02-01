import { HitDiceManager } from './HitDiceManager.js';
import { getManaRecoveryTypesFromClasses, restoresManaOnRest } from '../utils/manaRecovery.js';

// Uses NimbleCharacterInterface ambient type from actor.d.ts

/** Extended NimbleCharacter interface for RestManager */
interface RestableCharacter extends NimbleCharacterInterface {
	HitDiceManager: HitDiceManager;
}

class RestManager {
	#actor: RestableCharacter;

	#data: RestManager.Data;

	#restType: 'field' | 'safe';

	#summary: string[];

	#recovery: {
		hitDiceRecovered: Record<string, number>;
		hpRestored: number;
		tempHpRemoved: number;
		manaRestored: number;
		woundsRecovered: number;
	};

	#updates: { actor: Record<string, unknown>; items: Record<string, unknown>[] };

	// Fresh HitDiceManager instance created at rest time to ensure current data
	#hitDiceManager: HitDiceManager;

	constructor(actor: RestableCharacter, data: RestManager.Data) {
		this.#actor = actor;
		this.#summary = [];
		this.#restType = data.restType || 'field';

		// Create a fresh HitDiceManager to ensure we read current data
		this.#hitDiceManager = new HitDiceManager(actor);

		this.#updates = { actor: {}, items: [] };
		this.#recovery = {
			hitDiceRecovered: {},
			hpRestored: 0,
			tempHpRemoved: 0,
			manaRestored: 0,
			woundsRecovered: 0,
		};

		const defaultData: RestManager.Data = {
			restType: 'field',
			makeCamp: false,
			skipChatCard: false,
		};

		this.#data = foundry.utils.mergeObject(defaultData, data);
	}

	get restTypes(): string[] {
		if (this.#restType === 'safe') {
			return ['fieldRest', 'recharge', 'round', 'turn', 'minute', 'hour', 'safeRest', 'day'];
		}

		return ['fieldRest', 'recharge', 'round', 'turn', 'minute', 'hour'];
	}

	async rest() {
		const { skipChatCard, makeCamp = false, activeAdvantageRuleIds = [] } = this.#data;

		if (this.#restType === 'safe') {
			this.#restoreHitDice();
			this.#restoreHitPoints();
			if (this.#shouldRestoreMana('safe')) {
				this.#restoreMana();
			}
			this.#restoreWounds();
		}
		if (this.#restType === 'field' && this.#shouldRestoreMana('field')) {
			this.#restoreMana();
		}

		// TODO: Call Pre Hook

		// Roll hit dice and collect results
		const { rolls, totalHealing, hitDiceSpent } = await this.#consumeHitDice();

		// Update Documents
		await this.#actor.update(this.#updates.actor);
		await this.#actor.updateEmbeddedDocuments('Item', this.#updates.items);

		// Broadcast stylized safe rest chat card
		if (this.#restType === 'safe' && !skipChatCard) {
			const hasRecovery =
				Object.keys(this.#recovery.hitDiceRecovered).length > 0 ||
				this.#recovery.hpRestored > 0 ||
				this.#recovery.manaRestored > 0 ||
				this.#recovery.woundsRecovered > 0;

			// Only show chat card if something was recovered
			if (hasRecovery) {
				await ChatMessage.create({
					author: game.user?.id,
					speaker: {
						...ChatMessage.getSpeaker({ actor: this.#actor as object as Actor }),
						alias: this.#actor.name,
					},
					type: 'safeRest',
					system: {
						actorName: this.#actor.name,
						actorType: this.#actor.type,
						image: this.#actor.img,
						permissions: this.#actor.ownership?.[game.user?.id ?? ''] ?? 0,
						rollMode: 0,
						hitDiceRecovered: this.#recovery.hitDiceRecovered,
						hpRestored: this.#recovery.hpRestored,
						tempHpRemoved: this.#recovery.tempHpRemoved,
						manaRestored: this.#recovery.manaRestored,
						woundsRecovered: this.#recovery.woundsRecovered,
					},
				} as unknown as ChatMessage.CreateData);
			}
		}

		// Create stylized field rest chat card
		if (this.#restType === 'field' && !skipChatCard) {
			// Check modifiers
			const maximizeFromRules =
				(this.#actor.system.attributes as { maximizeHitDice?: boolean }).maximizeHitDice ?? false;
			const wasMaximized = makeCamp || maximizeFromRules;
			const hadAdvantage = activeAdvantageRuleIds.length > 0;

			// Get advantage source for display
			let advantageSource: string | null = null;
			if (hadAdvantage) {
				const advantageRules =
					(
						this.#actor.system.attributes as {
							hitDiceAdvantageRules?: Array<{ id: string; label: string; condition: string }>;
						}
					).hitDiceAdvantageRules ?? [];
				const activeRule = advantageRules.find((r) => activeAdvantageRuleIds.includes(r.id));
				if (activeRule) {
					advantageSource = `${activeRule.label} - ${activeRule.condition}`;
				}
			}

			await ChatMessage.create({
				author: game.user?.id,
				speaker: {
					...ChatMessage.getSpeaker({ actor: this.#actor as object as Actor }),
					alias: this.#actor.name,
				},
				sound: rolls.length > 0 ? CONFIG.sounds.dice : undefined,
				rolls: rolls.length > 0 ? rolls : undefined,
				type: 'fieldRest',
				system: {
					actorName: this.#actor.name,
					actorType: this.#actor.type,
					image: this.#actor.img,
					permissions: this.#actor.ownership?.[game.user?.id ?? ''] ?? 0,
					rollMode: 0,
					restType: makeCamp ? 'makeCamp' : 'catchBreath',
					hitDiceSpent,
					totalHealing,
					wasMaximized,
					hadAdvantage,
					advantageSource,
				},
			} as unknown as ChatMessage.CreateData);
		}

		// TODO: Call Post hook
	}

	/** ------------------------------------------ */
	/** Consume Methods                            */
	/** ------------------------------------------ */
	async #consumeHitDice(): Promise<{
		rolls: Roll[];
		totalHealing: number;
		hitDiceSpent: Record<string, number>;
	}> {
		const { selectedHitDice, makeCamp = false, activeAdvantageRuleIds = [] } = this.#data;

		// Check if the actor has the maximizeHitDice flag from rules (e.g., Oozeling's Odd Constitution)
		const maximizeFromRules =
			(this.#actor.system.attributes as { maximizeHitDice?: boolean }).maximizeHitDice ?? false;
		const shouldMaximize = makeCamp || maximizeFromRules;

		// Check if any advantage rules are active
		const hasAdvantage = activeAdvantageRuleIds.length > 0;

		const rolls: Roll[] = [];
		let totalHealing = 0;
		const hitDiceSpent: Record<string, number> = {};

		for (const [size, quantity] of Object.entries(selectedHitDice ?? {})) {
			if (quantity > 0) {
				hitDiceSpent[size] = quantity;
				// Skip individual chat messages - we'll create a combined one
				const result = await this.#actor.HitDiceManager.rollHitDice(
					Number(size),
					quantity,
					shouldMaximize,
					hasAdvantage,
					true, // skipChatMessage
				);
				if (result) {
					rolls.push(result.roll);
					totalHealing += result.healing;
				}
			}
		}

		return { rolls, totalHealing, hitDiceSpent };
	}

	/** ------------------------------------------ */
	/** Recovery Methods                           */
	/** ------------------------------------------ */
	#restoreHitDice() {
		// Safe rest restores ALL hit dice
		// Use fresh HitDiceManager to ensure current data
		const maxHitDice = this.#hitDiceManager.max;
		const { updates, recoveredData } = this.#hitDiceManager.getUpdateData({
			upperLimit: maxHitDice,
			restoreLargest: true,
		});

		this.#updates.actor = foundry.utils.mergeObject(this.#updates.actor, updates);

		Object.entries(recoveredData ?? {}).forEach(([die, amount]) => {
			this.#summary.push(`Recovered ${amount} hit dice. (d${die})`);
			this.#recovery.hitDiceRecovered[die] = amount;
		});
	}

	#restoreHitPoints() {
		const { value, max, temp } = this.#actor.system.attributes.hp;

		this.#updates.actor['system.attributes.hp'] = { value: max, temp: 0 };

		if (max > value) {
			this.#recovery.hpRestored = max - value;
			this.#summary.push(`Restored ${max - value} hp.`);
		}

		if (temp > 0) {
			this.#recovery.tempHpRemoved = temp;
			this.#summary.push(`Removed ${temp} temporary hp.`);
		}
	}

	#restoreMana() {
		const { current, max } = this.#actor.system.resources.mana;
		if (current < max) {
			this.#updates.actor['system.resources.mana'] = { current: max };
			this.#recovery.manaRestored = max - current;
			this.#summary.push(`Restored ${max - current} mana.`);
		}
	}

	#shouldRestoreMana(restType: 'field' | 'safe'): boolean {
		const recoveryTypes = getManaRecoveryTypesFromClasses(Object.values(this.#actor.classes ?? {}));
		return restoresManaOnRest(recoveryTypes, restType);
	}

	#restoreWounds() {
		const { value } = this.#actor.system.attributes.wounds;

		this.#updates.actor['system.attributes.wounds'] = {
			value: Math.max(value - 1, 0),
		};

		if (value !== 0) {
			this.#recovery.woundsRecovered = 1;
			this.#summary.push('Recovered 1 wound.');
		}
	}
}

declare namespace RestManager {
	interface Data {
		restType: 'field' | 'safe';
		makeCamp?: boolean;
		skipChatCard: boolean;
		selectedHitDice?: Record<number, number>;
		activeAdvantageRuleIds?: string[];
	}
}

export { RestManager };
