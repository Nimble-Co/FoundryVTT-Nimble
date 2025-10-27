import getDeterministicBonus from '../dice/getDeterministicBonus.js';
import type { NimbleClassItem } from '../documents/item/class.js';
import type { NimbleSubclassItem } from '../documents/item/subclass.js';
import {
	type NimbleBaseResource,
	ResourceDataModels,
} from '../models/item/components/ClassResourceDataModel.js';

class ClassResourceManager extends Map<string, InstanceType<typeof NimbleBaseResource>> {
	item: NimbleClassItem | NimbleSubclassItem;

	rollData: Record<string, number | string> = {};

	constructor(item: NimbleClassItem | NimbleSubclassItem) {
		super();

		this.item = item;

		item.system.resources.forEach((source: any) => {
			const Cls = ResourceDataModels[source.type];
			if (!Cls) {
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | Resource ${source.identifier} on ${item.name}(${item.uuid}) is not of a recognizable type.`,
				);
				return;
			}

			try {
				const resource = new Cls(source, { parent: item, strict: true });
				this.set(resource.identifier || resource.name.slugify({ strict: true }), resource);
			} catch (err) {
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | Resource ${source.identifier} on ${item.name}(${item.uuid}) is malformed.`,
				);
				// eslint-disable-next-line no-console
				console.error(err);
			}
		});
	}

	get level(): number | null {
		const { item } = this;
		if (item.isType('class')) return item.system.classLevel;

		const cls = (this.item as NimbleSubclassItem).class;
		if (!cls) return null;

		return cls.system.classLevel;
	}

	byType(type: string) {
		return [...this.entries()].filter(([, resource]) => resource.type === type);
	}

	prepareResources() {
		const { level } = this;
		if (!level) return;

		[...this.entries()].forEach(([id, resource]) => {
			let rawValue: string;
			if (resource.type === 'dice') {
				// TODO: Get this based on level
				rawValue = resource.formula() || '';
			} else {
				// @ts-expect-error
				rawValue = resource.levels?.[level] || '';
			}

			let value: string | number | null = null;

			try {
				const doc = this.item.isEmbedded ? (this.item.parent ?? this.item) : this.item;

				value = getDeterministicBonus(
					rawValue as string,
					// TODO: Types - Remove when types are fixed
					// @ts-ignore
					doc.getRollData(this.item),
					{ strict: true },
				);
			} catch (e) {
				value = rawValue;
			}

			if (!value) value = 0;

			this.rollData[id] = value;
		});
	}

	async add(data: Record<string, any> = {}) {
		if (!data.name) {
			const count = [...this].reduce(
				(acc, [, { name }]) => (name === 'New Resource' ? acc + 1 : acc),
				0,
			);

			if (count > 0) data.name = `New Resource ${count + 1}`;
			else data.name = 'New Resource';
		}

		await this.item.update({
			'system.resources': [...this.item.system.resources, data],
		});
	}

	async remove(identifier: string) {
		const filteredArray = this.item.system.resources.filter(
			(resource: any) =>
				resource.identifier !== identifier ||
				resource.name.slugify({ strict: true }) !== identifier,
		);

		await this.item.update({
			'system.resources': filteredArray,
		});
	}

	async removeAll() {
		await this.item.update({
			'system.resources': [],
		});
	}
}

export { ClassResourceManager };
