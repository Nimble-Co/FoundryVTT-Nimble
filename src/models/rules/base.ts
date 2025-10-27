import { PredicateField } from '../fields/PredicateField.js';
import type { NimbleBaseActor } from '../../documents/actor/base.svelte.js';
import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import type { Predicate } from '../../etc/Predicate.js';

function schema() {
	const { fields } = foundry.data;

	return {
		disabled: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		id: new fields.StringField({
			required: true,
			nullable: false,
			initial: () => foundry.utils.randomID(),
		}),
		identifier: new fields.StringField({ required: true, nullable: false, initial: '' }),
		label: new fields.StringField({ required: true, nullable: false, initial: '' }),
		predicate: new PredicateField(),
		priority: new fields.NumberField({ required: true, nullable: false, initial: 1 }),
	};
}

declare namespace NimbleBaseRule {
	type Schema = DataSchema & ReturnType<typeof schema>;
}

abstract class NimbleBaseRule<
	Schema extends NimbleBaseRule.Schema,
	Parent extends foundry.abstract.DataModel.Any = InstanceType<typeof NimbleBaseItem>,
> extends foundry.abstract.DataModel<Schema, Parent> {
	declare type: string;

	// @ts-expect-error
	declare predicate: Predicate;

	constructor(
		source: foundry.data.fields.SchemaField.InnerAssignmentType<Schema>,
		options?: foundry.abstract.DataModel.ConstructorOptions<Parent>,
	) {
		super(source, { parent: options?.parent, strict: options?.strict ?? true });

		if (this.invalid) {
			// @ts-expect-error
			this.disabled = true;
		}
	}

	static override defineSchema(): NimbleBaseRule.Schema {
		return {
			...schema(),
		};
	}

	// get uuid(): string {
	//   // @ts-expect-error
	//   return `${this.parent.uuid}.${this.id}`;
	// }

	get actor(): NimbleBaseActor {
		return this.item.actor;
	}

	get item(): NimbleBaseItem {
		// @ts-expect-error
		return this.parent;
	}

	tooltipInfo(props?: Map<string, string>): string {
		const sortedProps: Map<string, string> = new Map(
			// @ts-expect-error
			[
				['disabled', 'boolean'],
				['label', 'string'],
				['priority', 'number'],
				['type', 'string'],
				...(props ?? []),
			].sort((a, b) => a[0].localeCompare(b[0])),
		);

		const propData = [...sortedProps.entries()].map(
			([prop, type]) => `
        <div class="nimble-type-summary__line">
          <dt class="nimble-type-summary__property">
            ${prop}<span class="nimble-type-summary__operator">:</span>
          </dt>

          <dd class="nimble-type-summary__type-wrapper">
            <span class="nimble-type-summary__type">${type}</span>;
          </dd>
        </div>
      `,
		);

		const data = `
      <header> This rule has the following configurable properties: </header>

      <dl class="nimble-type-summary">
        <span class="nimble-type-summary__brace">{</span>

        ${propData.join('\n')}

        <span class="nimble-type-summary__brace">}</span>
      </dl>
    `;

		return data;
	}

	override validate(options: Record<string, any> = {}): boolean {
		try {
			// @ts-expect-error
			return super.validate(options);
		} catch (err) {
			if (err instanceof foundry.data.validation.DataModelValidationError) {
				const message = err.message.replace(
					/validation errors|Joint Validation Error/,
					`validation errors on item ${this.item.name} (${this.item.uuid})`,
				);
				// eslint-disable-next-line no-console
				console.warn(message);
				return false;
			}
			throw err;
		}
	}

	protected test(passedDomain?: string[] | Set<string>): boolean {
		if (this.disabled) return false;
		if (this.predicate.size === 0) return false;

		const domain = new Set<string>([
			...(passedDomain ?? this.actor?.getDomain() ?? []),
			...(this.item.getDomain() ?? []),
		]);

		return this.predicate.test(domain);
	}

	protected resolveFormula(formula: string) {
		const value = getDeterministicBonus(formula, this.actor?.getRollData() ?? {});
		return value;
	}

	override toString() {
		const data = this.toJSON();
		return JSON.stringify(data, null, 2);
	}
}

interface NimbleBaseRule<
	Schema extends NimbleBaseRule.Schema,
	Parent extends foundry.abstract.DataModel.Any = InstanceType<typeof NimbleBaseItem>,
> extends foundry.abstract.DataModel<Schema, Parent> {
	prePrepareData?(): void;

	afterPrepareData?(): void;

	preRoll?(): void;

	afterRoll?(): void;

	preCreate?(args: Record<string, any>): Promise<void>;

	afterCreate?(): void;

	preDelete?(): void;

	afterDelete?(): void;

	preUpdate?(changes: Record<string, unknown>): void;

	afterUpdate?(changes: Record<string, unknown>): void;

	preUpdateActor?(
		changes: Record<string, unknown>,
	): Promise<{ create?: any[]; delete?: string[] } | undefined>;
}

export { NimbleBaseRule };
