import { MigrationBase } from '../MigrationBase.js';

const RAGE_SOURCE_ID = 'Compendium.nimble.class-features.Item.GjPt8evcIoVuQ6zg';
const DEEP_RAGE_SOURCE_ID = 'Compendium.nimble.class-features.Item.Mbiu4fS3NVbXGVFq';

// Mirrors the pack JSON for Rage after the toggleEffect rework: the toggle
// rule that owns the Raging lifecycle, the raging-gated predicate on the
// Fury Dice auto-bonus consumer, and chat suppression on the pool nodes.

const RAGE_TOGGLE_RULE = {
	type: 'toggleEffect',
	disabled: false,
	id: 'rage-toggle',
	identifier: 'rage',
	label: 'Rage',
	predicate: {},
	priority: 1,
	tags: ['self:raging'],
	turnOff: ['onActorKilled', 'onUnconscious', 'onEncounterEnd', 'onRest'],
	confirmEndPrompt: 'NIMBLE.rules.featureMessages.berserker.rageEndConfirm',
	clearPoolsOnEnd: ['fury'],
	endAfterInactiveRounds: 1,
};

const DEEP_RAGE_MODIFY_TOGGLE_RULE = {
	type: 'modifyToggle',
	disabled: false,
	id: 'deep-rage-suppress-0hp',
	identifier: '',
	label: 'Deep Rage',
	predicate: {},
	priority: 1,
	toggleIdentifier: 'rage',
	suppressTurnOff: ['onUnconscious'],
};

const RAGE_POOL_NODE_IDS = new Set(['rage-fury-l1', 'rage-fury-l5']);

type RuleSource = { type?: unknown; id?: unknown; [key: string]: unknown };

/**
 * Reconciles embedded copies of Rage and Deep Rage with the toggleEffect
 * rework:
 *
 * - Rage gains the `rage-toggle` toggleEffect rule (Raging tag, turn-off
 *   triggers, end-confirm prompt, Fury pool clearing, inactivity timer).
 *   An existing rule with that id is replaced with the canonical shape so
 *   partial earlier versions of the rule are upgraded too.
 * - Rage's Fury Dice auto-bonus consumer becomes raging-gated: an empty
 *   predicate is set to `{ self: 'raging' }`. Non-empty predicates are left
 *   alone (assume deliberate customization).
 * - Rage's pool activation nodes get `suppressChat: true` so activating Rage
 *   does not produce duplicate roll chat.
 * - Deep Rage gains the `deep-rage-suppress-0hp` modifyToggle rule so
 *   dropping to 0 HP no longer ends Rage at level 18.
 *
 * Matches on compendium source id, falling back to berserker class + item
 * name for copies without one. Idempotent: every step checks current state
 * before mutating.
 */
class Migration026RageToggleEffect extends MigrationBase {
	static override readonly version = 26;

	override readonly version = Migration026RageToggleEffect.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;
		const sourceId = this.getSourceId(source);

		if (this.#matches(source, sourceId, RAGE_SOURCE_ID, 'rage')) {
			this.#migrateRage(source);
			return;
		}

		if (this.#matches(source, sourceId, DEEP_RAGE_SOURCE_ID, 'deep rage')) {
			this.#migrateDeepRage(source);
		}
	}

	/**
	 * Match by compendium source id first. Fall back to class + name for
	 * copies without a compendium source (progression-granted or hand-added
	 * items), which live testing showed the strict match misses.
	 */
	#matches(
		source: any,
		sourceId: string | undefined,
		expectedSourceId: string,
		normalizedName: string,
	): boolean {
		if (sourceId === expectedSourceId) return true;
		if (source?.system?.class !== 'berserker') return false;
		return typeof source.name === 'string' && source.name.trim().toLowerCase() === normalizedName;
	}

	#migrateRage(source: any): void {
		const system = (source.system ??= {} as Record<string, unknown>);
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules = system.rules as RuleSource[];

		// Replace-or-insert the toggle rule with the canonical shape.
		const toggleIndex = rules.findIndex((rule) => rule?.id === RAGE_TOGGLE_RULE.id);
		if (toggleIndex >= 0) {
			rules[toggleIndex] = foundry.utils.deepClone(RAGE_TOGGLE_RULE);
		} else {
			rules.push(foundry.utils.deepClone(RAGE_TOGGLE_RULE));
		}

		// Gate the Fury auto-bonus on the raging tag, but only when the
		// predicate is still the untouched default.
		const consumer = rules.find(
			(rule) => rule?.type === 'diceConsumer' && rule?.id === 'fury-pool-autobonus',
		);
		if (consumer) {
			const predicate = consumer.predicate;
			const isEmptyPredicate =
				!predicate ||
				(typeof predicate === 'object' && Object.keys(predicate as object).length === 0);
			if (isEmptyPredicate) {
				consumer.predicate = { self: 'raging' };
			}
		}

		// Suppress duplicate roll chat on the Fury pool activation nodes.
		const effects = (system.activation as { effects?: Array<Record<string, unknown>> })?.effects;
		if (Array.isArray(effects)) {
			for (const node of effects) {
				if (typeof node?.id !== 'string' || !RAGE_POOL_NODE_IDS.has(node.id)) continue;
				if (node.suppressChat !== true) node.suppressChat = true;
			}
		}

		// eslint-disable-next-line no-console
		console.log(
			`Nimble Migration | ${source.name ?? RAGE_SOURCE_ID}: reconciled toggleEffect rules`,
		);
	}

	#migrateDeepRage(source: any): void {
		const system = (source.system ??= {} as Record<string, unknown>);
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules = system.rules as RuleSource[];

		// Replace-or-insert with the canonical shape. Earlier iterations of
		// this rule suppressed onActorKilled instead of onUnconscious; a
		// presence-only check would leave those stale copies in place.
		const index = rules.findIndex((rule) => rule?.id === DEEP_RAGE_MODIFY_TOGGLE_RULE.id);
		if (index >= 0) {
			rules[index] = foundry.utils.deepClone(DEEP_RAGE_MODIFY_TOGGLE_RULE);
		} else {
			rules.push(foundry.utils.deepClone(DEEP_RAGE_MODIFY_TOGGLE_RULE));
		}

		// eslint-disable-next-line no-console
		console.log(
			`Nimble Migration | ${source.name ?? DEEP_RAGE_SOURCE_ID}: reconciled modifyToggle rule`,
		);
	}
}

export { Migration026RageToggleEffect };
