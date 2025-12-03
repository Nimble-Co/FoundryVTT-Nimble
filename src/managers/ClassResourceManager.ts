import getDeterministicBonus from '../dice/getDeterministicBonus.js';
import {
	type NimbleBaseResource,
	ResourceDataModels,
} from '../models/item/components/ClassResourceDataModel.js';

// Interface for class system with resources
interface ClassSystemWithResources {
	resources: Array<{ type: string; identifier?: string; name?: string }>;
	classLevel: number;
}

// Interface for subclass class reference
interface SubclassClassRef {
	system: ClassSystemWithResources;
}

// Type for resource instances
type ResourceInstance = InstanceType<typeof NimbleBaseResource> & {
	type: string;
	identifier?: string;
	name: string;
	formula?: () => string;
	levels?: Record<number, string>;
};

// Structural interface for items that can have resources managed
interface ResourceManagedItem {
	type: string;
	name: string;
	uuid: string;
	system: Record<string, unknown>;
	isEmbedded: boolean;
	parent: { getRollData(): Record<string, unknown> } | null;
	update(data: Record<string, unknown>): Promise<unknown>;
	getRollData?(): Record<string, unknown>;
}

class ClassResourceManager extends Map<string, ResourceInstance> {
	item: ResourceManagedItem;

	rollData: Record<string, number | string> = {};

	constructor(item: ResourceManagedItem) {
		super();

		this.item = item;

		const itemSystem = item.system as unknown as ClassSystemWithResources;
		itemSystem.resources.forEach((source) => {
			const Cls = ResourceDataModels[source.type];
			if (!Cls) {
				// eslint-disable-next-line no-console
				console.warn(
					`Nimble | Resource ${source.identifier} on ${item.name}(${item.uuid}) is not of a recognizable type.`,
				);
				return;
			}

			try {
				const resource = new Cls(source, { parent: item, strict: true }) as ResourceInstance;
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
		if (item.type === 'class') {
			const itemSystem = item.system as unknown as ClassSystemWithResources;
			return itemSystem.classLevel;
		}

		// For subclass, get level from the parent class reference
		const subclassWithClass = item as ResourceManagedItem & { class?: SubclassClassRef };
		const cls = subclassWithClass.class;
		if (!cls) return null;

		return cls.system.classLevel;
	}

	byType(type: string) {
		return [...this.entries()].filter(([, resource]) => resource.type === type);
	}

	prepareResources(): void {
		const { level } = this;
		if (!level) return;

		[...this.entries()].forEach(([id, resource]) => {
			let rawValue: string;
			if (resource.type === 'dice') {
				// TODO: Get this based on level
				rawValue = resource.formula?.() || '';
			} else {
				rawValue = resource.levels?.[level] || '';
			}

			let value: string | number | null = null;

			try {
				const doc = this.item.isEmbedded ? this.item.parent : this.item;
				const rollData = doc?.getRollData?.() ?? {};

				value = getDeterministicBonus(rawValue, rollData, { strict: true });
			} catch (_e) {
				value = rawValue;
			}

			if (!value) value = 0;

			this.rollData[id] = value;
		});
	}

	async add(data: Record<string, unknown> = {}): Promise<void> {
		if (!data.name) {
			const count = [...this].reduce(
				(acc, [, resource]) => (resource.name === 'New Resource' ? acc + 1 : acc),
				0,
			);

			if (count > 0) data.name = `New Resource ${count + 1}`;
			else data.name = 'New Resource';
		}

		const itemSystem = this.item.system as unknown as ClassSystemWithResources;
		await this.item.update({
			'system.resources': [...itemSystem.resources, data],
		});
	}

	async remove(identifier: string): Promise<void> {
		const itemSystem = this.item.system as unknown as ClassSystemWithResources;
		const filteredArray = itemSystem.resources.filter(
			(resource) =>
				resource.identifier !== identifier ||
				(resource.name as string | undefined)?.slugify?.({ strict: true }) !== identifier,
		);

		await this.item.update({
			'system.resources': filteredArray,
		});
	}

	async removeAll(): Promise<void> {
		await this.item.update({
			'system.resources': [],
		});
	}
}

export { ClassResourceManager };
