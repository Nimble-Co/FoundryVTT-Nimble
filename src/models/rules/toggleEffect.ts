import { SYSTEM_ID } from '#system';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
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
		// i18n key for the confirm-end dialog content. Empty = no prompt
		// (turn-off triggers and the effects-panel toggle path never prompt;
		// only the explicit on/off switch consults this).
		confirmEndPrompt: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.toggleEffect.confirmEndPrompt.label',
			hint: 'NIMBLE.rules.toggleEffect.confirmEndPrompt.hint',
		}),
		// Pool identifiers (dice or charge) to clear when the toggle ends,
		// either via a turn-off trigger or a player toggle-off. Lets authors
		// model rules like Berserker Rage's "Fury Dice are lost when your
		// Rage ends" without coupling toggleEffect to a specific feature.
		clearPoolsOnEnd: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.toggleEffect.clearPoolsOnEnd.label',
				hint: 'NIMBLE.rules.toggleEffect.clearPoolsOnEnd.hint',
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
	update(data: Record<string, unknown>): Promise<unknown>;
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
	declare confirmEndPrompt: string;
	declare clearPoolsOnEnd: string[];

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
	 * Toggle entry point. Ensures the backing AE is on when this rule's owning
	 * item is activated. Predicate-gated so authors can constrain when the
	 * toggle is allowed to flip.
	 *
	 * Item activation only turns the toggle ON; turning OFF is the player's
	 * job via the effects panel (or a `turnOff` trigger). This avoids
	 * misclick footguns where re-using the item mid-rage accidentally drops
	 * the effect.
	 *
	 * - no AE → create
	 * - existing AE disabled → re-enable
	 * - existing AE enabled → no-op
	 */
	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (context.sourceItem !== this.item) return;
		if (!this.test()) return;
		const existing = this.#findActiveEffect();
		if (!existing) {
			await this.#createActiveEffect();
			return;
		}
		if (existing.disabled) {
			await existing.update({ disabled: false });
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
		if (!existing) return;
		await this.#clearLinkedPools();
		await this.#deleteActiveEffect(existing.id);
	}

	/**
	 * Empty every pool listed in `clearPoolsOnEnd`. Used by both the
	 * automatic turn-off path and the player-initiated toggle-off so the
	 * "resources are lost when the effect ends" rule applies uniformly
	 * (e.g. Berserker Rage's Fury Dice).
	 */
	async #clearLinkedPools(): Promise<void> {
		const pools = this.clearPoolsOnEnd ?? [];
		if (pools.length < 1) return;
		const actor = this.actor as unknown as Actor | null | undefined;
		for (const poolId of pools) {
			const trimmed = (poolId ?? '').trim();
			if (trimmed.length < 1) continue;
			await setPoolFaces(actor, trimmed, []);
		}
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
		const item = this.item as unknown as { name: string; img: string; uuid: string; id: string };
		await actor.createEmbeddedDocuments('ActiveEffect', [
			{
				name: this.label || item.name,
				img: item.img,
				disabled: false,
				// Origin lets Foundry surface the source item in the effects
				// panel and lets downstream cleanup follow item deletion.
				origin: item.uuid,
				flags: {
					[SYSTEM_ID]: {
						[TOGGLE_EFFECT_RULE_ID_FLAG]: this.id,
						[TOGGLE_EFFECT_ITEM_ID_FLAG]: item.id,
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
