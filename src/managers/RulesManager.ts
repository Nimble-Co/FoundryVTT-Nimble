import type { RuleSource } from '#types/ruleSource.js';
import localize from '#utils/localize.js';
import type { NimbleBaseRule } from '../models/rules/base.js';

export namespace RulesManager {
	export interface AddOptions {
		update?: boolean;
	}
}

interface EffectRuleParent {
	documentName: 'ActiveEffect';
	name: string;
	uuid: string | null;
	system: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
}

/** A document that holds rules in `system.rules`. */
type RuleParent = NimbleBaseItem | EffectRuleParent;

function rulesOf(parent: RuleParent): RuleSource[] {
	return (parent.system as { rules?: RuleSource[] } | undefined)?.rules ?? [];
}

function isEffect(parent: RuleParent): parent is EffectRuleParent {
	return parent.documentName === 'ActiveEffect';
}

/**
 * Why a rule is not running, left unresolved until something asks to display it.
 * The manager is built during data preparation, which can run before `i18nInit`,
 * and `game.i18n.localize` returns the raw key when called that early.
 */
type RuleFailure =
	/** One of our own messages, resolved through `localize()` on read. */
	| { key: string; data?: Record<string, string> }
	/** Upstream English straight from Foundry validation or a thrown error. */
	| { text: string };

/** Flatten a data model's unresolved validation failures into one readable line. */
function describeValidationFailures(rule: InstanceType<typeof NimbleBaseRule>): RuleFailure {
	const { validationFailures } = rule as unknown as {
		validationFailures?: Record<string, { toString(): string; unresolved?: boolean } | null>;
	};

	// `toString()` walks nested field and element failures; plain `.message` is
	// only the header line ("SkillBonusRule validation errors:") and drops the
	// part that actually names the offending field.
	const messages = Object.values(validationFailures ?? {})
		.filter((failure) => failure?.unresolved)
		.map((failure) => failure?.toString().replace(/\s+/g, ' ').trim())
		.filter((message): message is string => Boolean(message));

	if (!messages.length) return { key: 'NIMBLE.rulesBuilder.ruleFailureValidation' };
	return { text: messages.join(' ') };
}

class RulesManager extends Map<string, InstanceType<typeof NimbleBaseRule>> {
	#parent: RuleParent;
	rulesTypeMap: Map<string, InstanceType<typeof NimbleBaseRule>>;

	/**
	 * Why a rule in `system.rules` is not running, keyed by rule id. A rule whose
	 * source fails to build is dropped from this map entirely, and one that builds
	 * with unresolved validation failures is force-disabled by the base rule — in
	 * both cases the authored source still renders in the Rules Builder, so the
	 * reason has to be recorded here for the card to surface it.
	 */
	readonly failures: Map<string, RuleFailure> = new Map();

	constructor(parent: RuleParent) {
		super();

		this.#parent = parent;
		const dataModels = CONFIG.NIMBLE.ruleDataModels;
		this.rulesTypeMap = new Map();

		rulesOf(parent).forEach((source) => {
			const Cls = dataModels[source.type];
			if (!Cls) {
				this.failures.set(source.id, {
					key: 'NIMBLE.rulesBuilder.ruleFailureUnknownType',
					data: { type: source.type },
				});
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | Rule ${source.id} on ${parent.name}(${parent.uuid}) is not of a recognizable type.`,
				);
				return;
			}

			if (isEffect(parent) && Cls.worksOnEffects === false) {
				this.failures.set(source.id, {
					key: 'NIMBLE.rulesBuilder.ruleFailureNotOnEffect',
					data: { type: source.type },
				});
				return;
			}

			try {
				const rule = new Cls(source, { parent, strict: true });
				this.set(rule.id, rule);
				this.rulesTypeMap.set(source.type, rule);

				if (rule.invalid) {
					this.failures.set(rule.id, describeValidationFailures(rule));
				}
			} catch (err) {
				this.failures.set(
					source.id,
					err instanceof Error
						? { text: err.message }
						: { key: 'NIMBLE.rulesBuilder.ruleFailureMalformed' },
				);
				// eslint-disable-next-line no-console
				console.warn(`Nimble | Rule ${source.id} on ${parent.name}(${parent.uuid}) is malformed.`);
				// eslint-disable-next-line no-console
				console.error(err);
			}
		});
	}

	/** The reason this rule is not running, or `undefined` when it is healthy. */
	failureFor(id: string): string | undefined {
		const failure = this.failures.get(id);
		if (!failure) return undefined;

		return 'text' in failure ? failure.text : localize(failure.key, failure.data);
	}

	/** ------------------------------------------------------ */
	/**                       Helpers                          */
	/** ------------------------------------------------------ */
	hasRuleOfType(type: string) {
		return this.rulesTypeMap.has(type);
	}

	getRuleOfType(type: string) {
		return this.rulesTypeMap.get(type);
	}

	async updateRule(id: string, data: string | Record<string, unknown>) {
		let updateData: Record<string, unknown>;

		if (typeof data === 'string') {
			try {
				updateData = JSON.parse(data);
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error(e);
				ui.notifications.error('An error occurred while updating rule');
				return false;
			}
		} else updateData = data;

		this.rulesTypeMap.set(
			updateData.type as string,
			updateData as object as InstanceType<typeof NimbleBaseRule>,
		);

		await this.#parent.update({
			'system.rules': rulesOf(this.#parent).map((r) => (r.id === id ? updateData : r)),
		} as Record<string, unknown>);

		return true;
	}

	async disableAllRules() {
		return this.#setAllRulesDisabledState(true);
	}

	async enableAllRules() {
		return this.#setAllRulesDisabledState(false);
	}

	/**
	 * The `system.rules` a bulk enable or disable would write, without writing it or
	 * touching this manager's own state. A caller changing something else on the same
	 * item persists both in one update, so the rules and what switched them can never
	 * end up disagreeing.
	 */
	withAllRulesDisabled(disabled: boolean): RuleSource[] {
		return rulesOf(this.#parent).map((rule) => ({ ...rule, disabled }));
	}

	async #setAllRulesDisabledState(disabled: boolean) {
		const updatedRules = this.withAllRulesDisabled(disabled);

		await this.#parent.update({
			'system.rules': updatedRules,
		} as Record<string, unknown>);

		return true;
	}

	async deleteRule(id: string) {
		return RulesManager.deleteRule(this.#parent, id);
	}

	static async deleteRule(parent: RuleParent, id: string) {
		return parent.update({
			'system.rules': rulesOf(parent).filter((r) => r.id !== id),
		} as Record<string, unknown>);
	}

	async reorderRules(idsInOrder: string[]) {
		return RulesManager.reorderRules(this.#parent, idsInOrder);
	}

	/**
	 * Writes `system.rules` reordered to match `idsInOrder`. Rules whose IDs are
	 * not present in `idsInOrder` are appended in their original relative order
	 * so an incomplete reorder does not silently drop data.
	 */
	static async reorderRules(parent: RuleParent, idsInOrder: string[]) {
		const existing = rulesOf(parent);
		const byId = new Map(existing.map((r) => [r.id, r]));
		const seen = new Set<string>();

		const reordered: RuleSource[] = [];
		for (const id of idsInOrder) {
			const rule = byId.get(id);
			if (!rule || seen.has(id)) continue;
			reordered.push(rule);
			seen.add(id);
		}
		for (const rule of existing) {
			if (!seen.has(rule.id)) reordered.push(rule);
		}

		await parent.update({
			'system.rules': reordered,
		} as Record<string, unknown>);

		return true;
	}

	async addRule(data: Record<string, unknown>, options: RulesManager.AddOptions = {}) {
		return RulesManager.addRule(this.#parent, data, options);
	}

	/** ------------------------------------------------------ */
	/**                   Static Methods                       */
	/** ------------------------------------------------------ */
	static async addRule(
		parent: RuleParent,
		data: Record<string, unknown>,
		options: RulesManager.AddOptions = {},
	) {
		const existingRules = rulesOf(parent);

		// Set defaults
		options.update ??= true;

		// TODO: Add validation for new data

		// Assign a stable id at creation so the rule has the same identity in
		// persisted JSON, in-memory data model, and Babele translation skeletons.
		const ruleData =
			typeof data.id === 'string' && data.id ? data : { ...data, id: foundry.utils.randomID() };

		if (options.update) {
			await parent.update({
				'system.rules': [...existingRules, ruleData],
			} as Record<string, unknown>);

			return rulesOf(parent).find((r) => r.id === ruleData.id);
		}

		const dataModels = CONFIG.NIMBLE.ruleDataModels;
		const type = ruleData.type;
		if (!type || typeof type !== 'string') {
			// eslint-disable-next-line no-console
			console.error('Nimble | Rule does not have a type.');
			return undefined;
		}

		const Cls = dataModels[type];
		if (!Cls) {
			// eslint-disable-next-line no-console
			console.error('Nimble | Rule is not of a recognizable type.');
			return undefined;
		}
		if (isEffect(parent) && Cls.worksOnEffects === false) {
			// eslint-disable-next-line no-console
			console.error(`Nimble | A ${type} rule works only on an item.`);
			return undefined;
		}

		return new Cls(ruleData, { parent });
	}
}

export { RulesManager, type RuleParent };
