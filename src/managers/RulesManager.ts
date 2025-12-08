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
	[key: string]: string | number | boolean | object | null | undefined;
}

/** Helper to get system data with rules */
function getSystemWithRules(item: NimbleBaseItem): ItemSystemWithRules {
	return item.system as object as ItemSystemWithRules;
}

class RulesManager extends Map<string, InstanceType<typeof NimbleBaseRule>> {
	#item: NimbleBaseItem;
	rulesTypeMap: Map<string, InstanceType<typeof NimbleBaseRule>>;

	constructor(item: NimbleBaseItem) {
		super();

		this.#item = item;
		const dataModels = CONFIG.NIMBLE.ruleDataModels;
		this.rulesTypeMap = new Map();

		const system = getSystemWithRules(item);
		system.rules.forEach((source) => {
			const Cls = dataModels[source.type];
			if (!Cls) {
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
			} catch (err) {
				// eslint-disable-next-line no-console
				console.warn(`Nimble | Rule ${source.id} on ${item.name}(${item.uuid}) is malformed.`);
				// eslint-disable-next-line no-console
				console.error(err);
			}
		});
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

	async deleteRule(id: string) {
		return RulesManager.deleteRule(this.#item, id);
	}

	static async deleteRule(item: NimbleBaseItem, id: string) {
		const system = getSystemWithRules(item);
		return item.update({
			'system.rules': system.rules?.filter((r) => r.id !== id) ?? [],
		} as Record<string, unknown>);
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
		const size: number = existingRules.length;

		// Set defaults
		options.update ??= true;
		data.name ??= `New Rule ${size + 1}`;

		// TODO: Add validation for new data

		if (options.update) {
			await item.update({
				'system.rules': [...existingRules, data],
			} as Record<string, unknown>);

			const existingIds = existingRules.map((r) => r.id);
			const updatedSystem = getSystemWithRules(item);
			return updatedSystem.rules.filter((r) => !existingIds.includes(r.id))?.[0];
		}

		const dataModels = CONFIG.NIMBLE.ruleDataModels;
		const type = data.type;
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

		const rule = new Cls(data, { parent: item });
		return rule;
	}
}

export { RulesManager };
