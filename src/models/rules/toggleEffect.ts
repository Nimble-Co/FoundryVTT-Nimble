import { SYSTEM_ID } from '#system';
import {
	type ActorHealthContext,
	type EncounterEndContext,
	type ItemActivatedContext,
	NimbleBaseRule,
	type RestContext,
	type TurnContext,
	type UnconsciousContext,
} from './base.js';

const TURN_OFF_CHOICES = [
	'onActorKilled',
	'onActorWounded',
	'onRest',
	'onTurnStart',
	'onTurnEnd',
	'onEncounterEnd',
	'onUnconscious',
] as const;

type TurnOffEvent = (typeof TURN_OFF_CHOICES)[number];

const TOGGLE_EFFECT_RULE_ID_FLAG = 'toggleEffectRuleId';
const TOGGLE_EFFECT_ITEM_ID_FLAG = 'toggleEffectItemId';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'toggleEffect' }),
		tags: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.toggleEffect.tags.label',
				hint: 'NIMBLE.rules.toggleEffect.tags.hint',
			},
		),
		turnOff: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: 'onRest',
				choices: TURN_OFF_CHOICES as unknown as string[],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.toggleEffect.turnOff.label',
				hint: 'NIMBLE.rules.toggleEffect.turnOff.hint',
			},
		),
	};
}

declare namespace ToggleEffectRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActiveEffectLike {
	id: string;
	disabled: boolean;
	getFlag(scope: string, key: string): unknown;
}

interface ActorWithEffects {
	effects: Iterable<ActiveEffectLike>;
	tags: Set<string>;
	createEmbeddedDocuments(
		type: 'ActiveEffect',
		data: Array<Record<string, unknown>>,
	): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

class ToggleEffectRule extends NimbleBaseRule<ToggleEffectRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.toggleEffect.description';

	declare tags: string[];
	declare turnOff: TurnOffEvent[];

	static override defineSchema(): ToggleEffectRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['tags', 'string[]'],
				[
					'turnOff',
					TURN_OFF_CHOICES.map((t) => `'${t}'`).join(
						' <span class="nimble-type-summary__operator">|</span> ',
					),
				],
			]),
		);
	}

	/**
	 * Push the configured tags into the actor's domain while the backing AE is
	 * enabled. Runs in prePrepareData so afterPrepareData consumers (the common
	 * case for bonus rules) always see the tags. Sibling rules whose
	 * prePrepareData consumes these tags must set a priority higher than this
	 * rule's priority (default 1).
	 */
	prePrepareData(): void {
		if (!this.item.isEmbedded) return;
		if (this.disabled) return;
		const effect = this.#findActiveEffect();
		if (!effect || effect.disabled) return;
		const actor = this.actor as unknown as ActorWithEffects;
		for (const tag of this.tags) actor.tags.add(tag);
	}

	/**
	 * Toggle entry point — flips the backing AE on/off when this rule's owning
	 * item is activated. Predicate-gated so authors can constrain when the
	 * toggle is allowed to flip.
	 */
	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (context.sourceItem !== this.item) return;
		if (!this.test()) return;
		const existing = this.#findActiveEffect();
		if (existing) {
			await this.#deleteActiveEffect(existing.id);
		} else {
			await this.#createActiveEffect();
		}
	}

	override async onActorKilled(context: ActorHealthContext): Promise<void> {
		await this.#maybeTurnOff('onActorKilled', context.actor);
	}

	override async onActorWounded(context: ActorHealthContext): Promise<void> {
		await this.#maybeTurnOff('onActorWounded', context.actor);
	}

	override async onRest(context: RestContext): Promise<void> {
		await this.#maybeTurnOff('onRest', context.actor);
	}

	override async onTurnStart(context: TurnContext): Promise<void> {
		await this.#maybeTurnOff('onTurnStart', context.actor);
	}

	override async onTurnEnd(context: TurnContext): Promise<void> {
		await this.#maybeTurnOff('onTurnEnd', context.actor);
	}

	override async onEncounterEnd(context: EncounterEndContext): Promise<void> {
		await this.#maybeTurnOff('onEncounterEnd', context.actor);
	}

	override async onUnconscious(context: UnconsciousContext): Promise<void> {
		await this.#maybeTurnOff('onUnconscious', context.actor);
	}

	async #maybeTurnOff(event: TurnOffEvent, actor: unknown): Promise<void> {
		if (actor !== this.actor) return;
		if (!this.turnOff.includes(event)) return;
		const existing = this.#findActiveEffect();
		if (existing) await this.#deleteActiveEffect(existing.id);
	}

	#findActiveEffect(): ActiveEffectLike | null {
		const actor = this.actor as unknown as ActorWithEffects;
		for (const effect of actor.effects) {
			const ruleId = effect.getFlag(SYSTEM_ID, TOGGLE_EFFECT_RULE_ID_FLAG);
			if (ruleId === this.id) return effect;
		}
		return null;
	}

	async #createActiveEffect(): Promise<void> {
		const actor = this.actor as unknown as ActorWithEffects;
		const item = this.item as unknown as { name: string; img: string };
		await actor.createEmbeddedDocuments('ActiveEffect', [
			{
				name: this.label || item.name,
				img: item.img,
				disabled: false,
				flags: {
					[SYSTEM_ID]: {
						[TOGGLE_EFFECT_RULE_ID_FLAG]: this.id,
						[TOGGLE_EFFECT_ITEM_ID_FLAG]: (this.item as unknown as { id: string }).id,
					},
				},
			},
		]);
	}

	async #deleteActiveEffect(id: string): Promise<void> {
		const actor = this.actor as unknown as ActorWithEffects;
		await actor.deleteEmbeddedDocuments('ActiveEffect', [id]);
	}
}

export { ToggleEffectRule, TURN_OFF_CHOICES, type TurnOffEvent };
