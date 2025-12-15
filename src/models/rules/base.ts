import type { NimbleRollData } from '#types/rollData.d.ts';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import type { Predicate } from '../../etc/Predicate.js';
import { PredicateField } from '../fields/PredicateField.js';

// Forward declarations to avoid circular dependencies
interface NimbleBaseActor extends Actor {
	getDomain(): Set<string>;
	getRollData(): NimbleRollData;
}

interface NimbleBaseItem extends Item {
	getDomain(): Set<string>;
	uuid: string;
	name: string;
	actor: NimbleBaseActor;
	sourceId: string | undefined;
	grantedBy: NimbleBaseItem | null;
}

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
	type Schema = foundry.data.fields.DataSchema & ReturnType<typeof schema>;
}

interface PreCreateArgs {
	itemSource: foundry.data.fields.SchemaField.AssignmentData<Item.Schema> & { _id?: string };
	pendingItems: Array<foundry.data.fields.SchemaField.AssignmentData<Item.Schema>>;
	tempItems: Item[];
	operation: { keepId?: boolean };
}

abstract class NimbleBaseRule<
	Schema extends NimbleBaseRule.Schema = NimbleBaseRule.Schema,
	Parent extends foundry.abstract.DataModel.Any = foundry.abstract.DataModel.Any,
> extends foundry.abstract.DataModel<Schema, Parent> {
	declare type: string;

	declare disabled: boolean;

	declare id: string;

	declare identifier: string;

	declare label: string;

	declare priority: number;

	constructor(
		source: foundry.data.fields.SchemaField.CreateData<Schema>,
		options?: { parent?: Parent; strict?: boolean },
	) {
		super(source, {
			parent: options?.parent,
			strict: options?.strict ?? true,
		} as foundry.abstract.DataModel.ConstructionContext<Parent>);

		if (this.invalid) {
			this.disabled = true;
		}
	}

	static override defineSchema(): NimbleBaseRule.Schema {
		return {
			...schema(),
		};
	}

	// get uuid(): string {
	//   return `${this.parent.uuid}.${this.id}`;
	// }

	get actor(): NimbleBaseActor {
		return this.item.actor;
	}

	get item(): NimbleBaseItem {
		return this.parent as object as NimbleBaseItem;
	}

	tooltipInfo(props?: Map<string, string>): string {
		const baseProps: [string, string][] = [
			['disabled', 'boolean'],
			['label', 'string'],
			['priority', 'number'],
			['type', 'string'],
		];
		const allProps = [...baseProps, ...(props ?? new Map<string, string>())].sort((a, b) =>
			a[0].localeCompare(b[0]),
		);
		const sortedProps: Map<string, string> = new Map(allProps);

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

	protected get _predicate(): Predicate {
		return (this as object as { predicate: Predicate }).predicate;
	}

	protected test(passedDomain?: string[] | Set<string>): boolean {
		if (this.disabled) return false;
		if (this._predicate.size === 0) return false;

		const domain = new Set<string>([
			...(passedDomain ?? this.actor?.getDomain() ?? []),
			...(this.item.getDomain() ?? []),
		]);

		return this._predicate.test(domain);
	}

	protected resolveFormula(formula: string) {
		const value = getDeterministicBonus(formula, this.actor?.getRollData() ?? {});
		return value;
	}

	/**
	 * Hook called during item pre-creation. Override in subclasses to implement rule-specific logic.
	 */
	async preCreate(_args: PreCreateArgs): Promise<void> {
		// Default implementation does nothing
	}

	/**
	 * Hook called after data preparation. Override in subclasses to implement rule-specific logic.
	 */
	afterPrepareData(): void {
		// Default implementation does nothing
	}

	override toString() {
		const data = this.toJSON();
		return JSON.stringify(data, null, 2);
	}
}

export { NimbleBaseRule, type PreCreateArgs };
