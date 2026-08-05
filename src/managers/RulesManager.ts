import type { NimbleBaseRule } from '../models/rules/base.js';

export namespace RulesManager {
	export interface AddOptions {
		update?: boolean;
	}
}

/** Interface for item system data that includes rules */
interface ItemSystemWithRules {
	rules: RuleSource[];
}

interface RuleSource {
	id: string;
	type: string;
	disabled?: boolean;
	[key: string]: string | number | boolean | object | null | undefined;
}

/** Helper to get system data with rules */
function getSystemWithRules(item: NimbleBaseItem): ItemSystemWithRules {
	return item.system as object as ItemSystemWithRules;
}

/** Flatten a data model's unresolved validation failures into one readable line. */
function describeValidationFailures(rule: InstanceType<typeof NimbleBaseRule>): string {
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

	if (!messages.length) return 'The rule failed validation and has been disabled.';
	return messages.join(' ');
}

class RulesManager extends Map<string, InstanceType<typeof NimbleBaseRule>> {
	#item: NimbleBaseItem;
	rulesTypeMap: Map<string, InstanceType<typeof NimbleBaseRule>>;

	/**
	 * Why a rule in `system.rules` is not running, keyed by rule id. A rule whose
	 * source fails to build is dropped from this map entirely, and one that builds
	 * with unresolved validation failures is force-disabled by the base rule — in
	 * both cases the authored source still renders in the Rules Builder, so the
	 * reason has to be recorded here for the card to surface it.
	 */
	readonly failures: Map<string, string> = new Map();

	constructor(item: NimbleBaseItem) {
		super();

		this.#item = item;
		const dataModels = CONFIG.NIMBLE.ruleDataModels;
		this.rulesTypeMap = new Map();

		const system = getSystemWithRules(item);
		system.rules.forEach((source) => {
			const Cls = dataModels[source.type];
			if (!Cls) {
				this.failures.set(source.id, `"${source.type}" is not a recognized rule type.`);
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | Rule ${source.id} on ${item.name}(${item.uuid}) is not of a recognizable type.`,
				);
				return;
			}

			try {
				const rule = new Cls(source, { parent: item, strict: true });
				this.set(rule.id, rule);
				this.rulesTypeMap.set(source.type, rule);

				if (rule.invalid) {
					this.failures.set(rule.id, describeValidationFailures(rule));
				}
			} catch (err) {
				this.failures.set(
					source.id,
					err instanceof Error ? err.message : 'The rule source is malformed.',
				);
				// eslint-disable-next-line no-console
				console.warn(`Nimble | Rule ${source.id} on ${item.name}(${item.uuid}) is malformed.`);
				// eslint-disable-next-line no-console
				console.error(err);
			}
		});
	}

	/** The reason this rule is not running, or `undefined` when it is healthy. */
	failureFor(id: string): string | undefined {
		return this.failures.get(id);
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

		const system = getSystemWithRules(this.#item);
		await this.#item.update({
			'system.rules': system.rules.map((r) => (r.id === id ? updateData : r)),
		} as Record<string, unknown>);

		return true;
	}

	async disableAllRules() {
		return this.#setAllRulesDisabledState(true);
	}

	async enableAllRules() {
		return this.#setAllRulesDisabledState(false);
	}

	async #setAllRulesDisabledState(disabled: boolean) {
		const system = getSystemWithRules(this.#item);
		const updatedRules = (system.rules ?? []).map((rule) => ({
			...rule,
			disabled,
		}));

		for (const rule of updatedRules) {
			this.rulesTypeMap.set(rule.type, rule as object as InstanceType<typeof NimbleBaseRule>);
		}

		await this.#item.update({
			'system.rules': updatedRules,
		} as Record<string, unknown>);

		return true;
	}

	async deleteRule(id: string) {
		return RulesManager.deleteRule(this.#item, id);
	}

	static async deleteRule(item: NimbleBaseItem, id: string) {
		const system = getSystemWithRules(item);
		return item.update({
			'system.rules': system.rules?.filter((r) => r.id !== id) ?? [],
		} as Record<string, unknown>);
	}

	async reorderRules(idsInOrder: string[]) {
		return RulesManager.reorderRules(this.#item, idsInOrder);
	}

	/**
	 * Writes `system.rules` reordered to match `idsInOrder`. Rules whose IDs are
	 * not present in `idsInOrder` are appended in their original relative order
	 * so an incomplete reorder does not silently drop data.
	 */
	static async reorderRules(item: NimbleBaseItem, idsInOrder: string[]) {
		const system = getSystemWithRules(item);
		const existing = system.rules ?? [];
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

		await item.update({
			'system.rules': reordered,
		} as Record<string, unknown>);

		return true;
	}

	async addRule(data: Record<string, unknown>, options: RulesManager.AddOptions = {}) {
		return RulesManager.addRule(this.#item, data, options);
	}

	/** ------------------------------------------------------ */
	/**                   Static Methods                       */
	/** ------------------------------------------------------ */
	static async addRule(
		item: NimbleBaseItem,
		data: Record<string, unknown>,
		options: RulesManager.AddOptions = {},
	) {
		const system = getSystemWithRules(item);
		const existingRules = system.rules;

		// Set defaults
		options.update ??= true;

		// TODO: Add validation for new data

		// Assign a stable id at creation so the rule has the same identity in
		// persisted JSON, in-memory data model, and Babele translation skeletons.
		const ruleData =
			typeof data.id === 'string' && data.id ? data : { ...data, id: foundry.utils.randomID() };

		if (options.update) {
			await item.update({
				'system.rules': [...existingRules, ruleData],
			} as Record<string, unknown>);

			const updatedSystem = getSystemWithRules(item);
			return updatedSystem.rules.find((r) => r.id === ruleData.id);
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

		const rule = new Cls(ruleData, { parent: item });
		return rule;
	}
}

export { RulesManager };
