import type { EffectNode } from '#types/effectTree.js';
import type { NimbleRollData } from '#types/rollData.d.ts';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import type { Predicate } from '../../etc/Predicate.js';
import { PredicateField } from '../fields/PredicateField.js';
import { actorAccumulatorPaths } from './accumulatorRegistry.js';

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

// Context passed to onItemUsed — fires per target when damage from an item's
// use is actually applied to that target (NOT when the roll lands). This
// ensures rules don't trigger on a hit the GM later voids.
interface ItemUsedContext {
	sourceItem: NimbleBaseItem;
	sourceActor: NimbleBaseActor;
	targetActor: NimbleBaseActor;
	card: ChatMessage | null;
	isCritical: boolean;
	isMiss: boolean;
}

// Context passed to getActivationCardNodes when a chat card renders.
interface ActivationCardContext {
	isCritical: boolean;
	isMiss: boolean;
}

interface TurnContext {
	combat: Combat;
	combatant: Combatant;
	actor: NimbleBaseActor;
}

interface ActorHealthContext {
	actor: NimbleBaseActor;
	previousHp: number;
	currentHp: number;
}

interface SaveResolvedContext {
	actor: NimbleBaseActor;
	saveType: string;
	outcome: 'pass' | 'fail';
}

interface RestContext {
	actor: NimbleBaseActor;
	restType: 'safe' | 'field';
}

interface InitiativeRolledContext {
	actor: NimbleBaseActor;
	combatant: Combatant;
}

// Context passed to onItemActivated. Fires once per item activation, regardless
// of whether the activation produced damage (unlike onItemUsed, which only fires
// when damage is actually applied to a target). Use this for player-controlled
// toggles and other rule-lifecycle work that should happen on every activation.
interface ItemActivatedContext {
	sourceItem: NimbleBaseItem;
	sourceActor: NimbleBaseActor;
	card: ChatMessage | null;
}

// Context passed to onEncounterEnd. Fires once per combatant when a combat
// ends (either via updateCombat transitioning started: true → false, or via
// deleteCombat as a fallback; the dispatcher dedup's the pair).
interface EncounterEndContext {
	combat: Combat;
	actor: NimbleBaseActor;
}

// Context passed to onActorDying. Fires when an actor enters the Dying state:
// dropped to 0 HP with an unfilled wound track, or the Dying condition applied
// directly. Distinct from onActorKilled (0 HP with a full wound track, or a
// monster with no wound track), which represents death rather than dying.
interface ActorDyingContext {
	actor: NimbleBaseActor;
	source: NimbleBaseItem | null;
}

// Context passed to onRoundChanged. Fires once per combatant whenever the
// combat's round counter changes, in either direction (turn advance across a
// round boundary, round buttons, or a manual tracker edit). `round` is the
// new value. Lets rules with round-stamped state react to rewinds, which
// turn events alone cannot surface.
interface RoundChangedContext {
	combat: Combat;
	actor: NimbleBaseActor;
	round: number;
}

abstract class NimbleBaseRule<
	Schema extends NimbleBaseRule.Schema = NimbleBaseRule.Schema,
	Parent extends foundry.abstract.DataModel.Any = foundry.abstract.DataModel.Any,
> extends foundry.abstract.DataModel<Schema, Parent> {
	// Class-level presentation metadata for the rules-builder UI.
	// Subclasses override with concrete values; the picker treats `'unsorted'`
	// or an empty `description` as a development-mode warning.
	static group: string = 'unsorted';

	static description: string = '';

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

	/**
	 * Public predicate-check entry point for callers outside the rule class.
	 * Returns `true` when the rule's predicate matches the actor's current
	 * domain (and the rule is enabled). Wraps the protected `test()` so the
	 * shape of `_predicate.test()` and the disabled/predicate handling stays
	 * encapsulated.
	 */
	appliesTo(passedDomain?: string[] | Set<string>): boolean {
		return this.test(passedDomain);
	}

	protected test(passedDomain?: string[] | Set<string>): boolean {
		if (this.disabled) return false;
		// Empty predicate means "no conditions" = always pass
		if (this._predicate.size === 0) return true;

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

	/** Matches dice notation: 1d6, 2d8+5, bare d20 — but not identifiers like "id6". */
	static #DICE_PATTERN = /(?<![a-zA-Z])d\d+/i;

	/** Whether the formula contains dice notation (e.g. 1d6, 2d8+5). */
	protected isDiceExpression(formula: string): boolean {
		return NimbleBaseRule.#DICE_PATTERN.test(formula);
	}

	/**
	 * Push an entry onto an accumulator array on the actor's system data,
	 * initializing the array on first use. For rules that stack entries during
	 * data prep (damageBonuses, damageReductions). Registers the path so the
	 * actor can reset the array at the start of each prepare cycle.
	 */
	protected pushToActorSystemArray<T>(path: string, entry: T): void {
		actorAccumulatorPaths.add(path);
		const { actor } = this.item;
		const existing = foundry.utils.getProperty(actor.system, path) as T[] | undefined;
		if (Array.isArray(existing)) {
			existing.push(entry);
			return;
		}
		foundry.utils.setProperty(actor.system, path, [entry]);
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

	/**
	 * Hook called after an item is used and a chat card is produced.
	 * Dispatched by ruleEventDispatch for attack-outcome triggers (onHit/onCrit/onMiss).
	 */
	async onItemUsed(_context: ItemUsedContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called at the start of a combatant's turn. */
	async onTurnStart(_context: TurnContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called at the end of a combatant's turn. */
	async onTurnEnd(_context: TurnContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called when an actor's HP drops to 0 or below. */
	async onActorKilled(_context: ActorHealthContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called when an actor takes a wound (bloodied / lastStand transition). */
	async onActorWounded(_context: ActorHealthContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called when a saving throw resolves. */
	async onSaveResolved(_context: SaveResolvedContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called when an actor completes a rest. */
	async onRest(_context: RestContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called when an actor rolls initiative. */
	async onInitiativeRolled(_context: InitiativeRolledContext): Promise<void> {
		// Default implementation does nothing
	}

	/**
	 * Hook called once per item activation (post chat-card), regardless of whether
	 * the activation produced damage. Use this for player-controlled toggles like
	 * toggleEffect. Unlike onItemUsed, this fires on every activation, even for
	 * items that don't roll damage.
	 */
	async onItemActivated(_context: ItemActivatedContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called once per combatant when a combat ends. */
	async onEncounterEnd(_context: EncounterEndContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called when an actor enters the Dying state (0 HP, wounds below max). */
	async onActorDying(_context: ActorDyingContext): Promise<void> {
		// Default implementation does nothing
	}

	/** Hook called once per combatant when the combat's round counter changes. */
	async onRoundChanged(_context: RoundChangedContext): Promise<void> {
		// Default implementation does nothing
	}

	/**
	 * Called by the chat card renderer when an activation card resolves, for every
	 * rule on the speaker actor. Returns zero or more EffectNode entries to inject
	 * into the card's render tree — surfaces rule-driven outcomes (e.g. a
	 * rule-derived ConditionNode) in the card regardless of automation settings.
	 */
	getActivationCardNodes(_context: ActivationCardContext): EffectNode[] {
		// Default implementation contributes no nodes
		return [];
	}

	/**
	 * A rule returns `true` when its activation flow posts its own chat
	 * message (e.g. a manual dice spend), making the default activation card
	 * redundant. The card is only suppressed when the activation itself has
	 * nothing to show — no rolls and no effect nodes.
	 */
	suppressesActivationCard(): boolean {
		return false;
	}

	override toString() {
		const data = this.toJSON();
		return JSON.stringify(data, null, 2);
	}
}

export {
	NimbleBaseRule,
	type PreCreateArgs,
	type ItemUsedContext,
	type TurnContext,
	type ActorHealthContext,
	type SaveResolvedContext,
	type RestContext,
	type InitiativeRolledContext,
	type ActivationCardContext,
	type ItemActivatedContext,
	type EncounterEndContext,
	type ActorDyingContext,
	type RoundChangedContext,
};
