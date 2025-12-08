import getDeterministicBonus from '../dice/getDeterministicBonus.js';
import {
	type NimbleBaseResource,
	type NimbleDiceResource,
	ResourceDataModels,
} from '../models/item/components/ClassResourceDataModel.js';

type ResourceInstance = InstanceType<typeof NimbleBaseResource>;

interface ResourceSource {
	type: string;
	identifier?: string;
	name?: string;
}

interface ClassResourceItem {
	name: string;
	uuid: string;
	isEmbedded: boolean;
	type: string;
	parent: NimbleBaseActor | null;
	system: {
		classLevel?: number;
		resources: object[];
	};
	class?: { system: { classLevel: number } } | null;
	getRollData?(item?: unknown): Record<string, unknown>;
	update(data: Record<string, unknown>): Promise<unknown>;
}

class ClassResourceManager extends Map<string, ResourceInstance> {
	item: ClassResourceItem;

	rollData: Record<string, number | string> = {};

	constructor(item: ClassResourceItem) {
		super();

		this.item = item;

		(item.system.resources as ResourceSource[]).forEach((source) => {
			const Cls = ResourceDataModels[source.type as keyof typeof ResourceDataModels];
			if (!Cls) {
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | Resource ${source.identifier} on ${item.name}(${item.uuid}) is not of a recognizable type.`,
				);
				return;
			}

			try {
				const ResourceClass = Cls as unknown as new (
					source: ResourceSource,
					options: { parent: ClassResourceItem; strict: boolean },
				) => ResourceInstance;
				const resource = new ResourceClass(source, { parent: item, strict: true });
				const key =
					resource.identifier ||
					(resource.name as string)?.slugify?.({ strict: true }) ||
					source.identifier ||
					'';
				this.set(key, resource);
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
		if (item.type === 'class') return item.system.classLevel ?? null;

		const cls = item.class;
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
				const diceResource = resource as InstanceType<typeof NimbleDiceResource>;
				rawValue = diceResource.formula || '';
			} else {
				const resourceWithLevels = resource as ResourceInstance & {
					levels?: Record<number, string>;
				};
				const levelValue = resourceWithLevels.levels?.[level];
				rawValue = typeof levelValue === 'string' ? levelValue : '';
			}

			let value: string | number | null = null;

			try {
				const doc = this.item.isEmbedded ? (this.item.parent ?? this.item) : this.item;
				const rollDataSource = doc as { getRollData?(item?: unknown): Record<string, unknown> };
				value = getDeterministicBonus(
					rawValue as string,
					rollDataSource.getRollData?.(this.item) ?? {},
					{ strict: true },
				);
			} catch (_e) {
				value = rawValue;
			}

			if (!value) value = 0;

			this.rollData[id] = value;
		});
	}

	async add(data: Record<string, unknown> = {}) {
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
		const filteredArray = (this.item.system.resources as ResourceSource[]).filter(
			(resource) =>
				resource.identifier !== identifier ||
				(resource.name as string | undefined)?.slugify?.({ strict: true }) !== identifier,
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

export { ClassResourceManager, type ClassResourceItem };
