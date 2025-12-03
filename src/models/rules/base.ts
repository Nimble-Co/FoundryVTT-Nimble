import { PredicateField } from '../fields/PredicateField.js';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import type { Predicate } from '../../etc/Predicate.js';

// Forward declarations to avoid circular dependencies
interface NimbleBaseActor extends Actor {
	getDomain(): Set<string>;
	getRollData(): Record<string, any>;
}

interface NimbleBaseItem extends Item {
	getDomain(): Set<string>;
	uuid: string;
	name: string;
	actor: NimbleBaseActor;
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

// Type alias for the base schema
type BaseRuleSchema = ReturnType<typeof schema>;

declare namespace NimbleBaseRule {
	type Schema = BaseRuleSchema;
}

abstract class NimbleBaseRule<
		Schema extends NimbleBaseRule.Schema,
		Parent extends foundry.abstract.DataModel.Any = NimbleBaseItem,
	>
	extends foundry.abstract.DataModel<Schema, Parent>
	implements NimbleBaseRule<Schema, Parent>
{
	declare type: string;
	declare disabled: boolean;
	declare id: string;
	declare identifier: string;
	declare label: string;
	declare priority: number;

	declare predicate: Predicate;

	constructor(
		source: foundry.data.fields.SchemaField.InnerAssignmentType<Schema>,
		options?: { parent?: Parent; strict?: boolean },
	) {
		// @ts-expect-error - Schema type flexibility needed for DataModel construction
		super(source, { parent: options?.parent, strict: options?.strict ?? true });

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

	override validate(options: Record<string, unknown> = {}): boolean {
		try {
			return super.validate(options) as boolean;
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

export { NimbleBaseRule };
