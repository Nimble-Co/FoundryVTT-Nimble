import type { NimbleBaseItem } from '../documents/item/base.svelte.js';
import type { NimbleBaseRule } from '../models/rules/base.js';

namespace RulesManager {
	export interface AddOptions {
		/** Update the parent item. Default `true` */
		update?: boolean;
	}
}
class RulesManager extends Map<string, InstanceType<typeof NimbleBaseRule>> {
	#item: NimbleBaseItem;
  rulesTypeMap: Map<string, InstanceType<typeof NimbleBaseRule>>;

	constructor(item: NimbleBaseItem) {
		super();

		this.#item = item;
		const dataModels = CONFIG.NIMBLE.ruleDataModels;
		this.rulesTypeMap = new Map();

		item.system.rules.forEach((source: any) => {
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
	async addRule(data: Record<string, any>, options: RulesManager.AddOptions = {}) {
		return RulesManager.addRule(this.#item, data, options);
	}

	hasRuleOfType(type: string) {
		return this.rulesTypeMap.has(type);
	}

	getRuleOfType(type: string) {
		return this.rulesTypeMap.get(type);
	}

	async deleteRule(id: string) {
		return RulesManager.deleteRule(this.#item, id);
	}

	async updateRule(id: string, data: string | Record<string, any>) {
		let updateData: Record<string, any>;

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

		this.rulesTypeMap.set(updateData.type, updateData as InstanceType<typeof NimbleBaseRule>);

		await this.#item.update({
			'system.rules': this.#item.system.rules.map((r) => (r.id === id ? updateData : r)),
		});

		return true;
	}

	/** ------------------------------------------------------ */
	/**                   Static Methods                       */
	/** ------------------------------------------------------ */
	static async addRule(
		item: NimbleBaseItem,
		data: Record<string, any>,
		options: RulesManager.AddOptions = {},
	) {
		const existingRules = item.system.rules;
		const size: number = existingRules.length;

		// Set defaults
		options.update ??= true;
		data.name ??= `New Rule ${size + 1}`;

		// TODO: Add validation for new data

		if (options.update) {
			await item.update({
				// @ts-expect-error
				'system.rules': [...existingRules, data],
			});

			const existingIds = existingRules.map((r) => r.id);
			return item.system.rules.filter((r) => !existingIds.includes(r.id))?.[0];
		}

		const dataModels = CONFIG.NIMBLE.ruleDataModels;
		const { type } = data;
		if (!type) {
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

	static async deleteRule(item: NimbleBaseItem, id: string) {
		return item.update({
			'system.rules': item.system.rules?.filter((r) => r.id !== id) ?? [],
		});
	}
}

export { RulesManager };
