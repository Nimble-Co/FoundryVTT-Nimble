import {
	findToggleEffect,
	modifyToggleRulesFor,
	TOGGLE_EFFECT_ITEM_ID_FLAG,
	TOGGLE_EFFECT_RULE_ID_FLAG,
	type ToggleActorLike,
	type ToggleItemLike,
	turnToggleOn,
} from '#utils/actor/toggleEffectData.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import localize from '#utils/localize.js';
import { firesCritTriggers } from '#utils/reroll/firesCritTriggers.js';
import { isChatNotificationsAutomationEnabled } from '../../settings/automationSettings.js';
import { withWidget } from './_widgetOption.js';
import {
	type ActorDyingContext,
	type ItemActivatedContext,
	type ItemUsedContext,
	NimbleBaseRule,
	type TurnContext,
} from './base.js';

// Events on which a modifyToggle rule can automatically switch the target toggle ON.
const TURN_ON_CHOICES = ['onTurnStart', 'onActorDying', 'onCritReceived'] as const;

type TurnOnEvent = (typeof TURN_ON_CHOICES)[number];

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
		effectId: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.toggleEffect.effectId.label',
				hint: 'NIMBLE.rules.toggleEffect.effectId.hint',
				widget: 'itemEffectPicker',
			}),
		),
		// Plain text or an i18n key, so homebrew items can set a prompt without translation files.
		confirmEndPrompt: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.toggleEffect.confirmEndPrompt.label',
			hint: 'NIMBLE.rules.toggleEffect.confirmEndPrompt.hint',
		}),
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

interface ActorWithEffects extends ToggleActorLike {
	tags: Set<string>;
}

class ToggleEffectRule extends NimbleBaseRule<ToggleEffectRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.toggleEffect.description';

	// Turning the toggle ON via item activation has no manual fallback, so that dispatch survives
	// the rule-automation toggle. The automatic turn-on stays gated.
	static override alwaysDispatchedEvents: readonly (keyof NimbleBaseRule)[] = ['onItemActivated'];

	declare tags: string[];
	declare effectId: string;
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
				['effectId', 'string'],
				['confirmEndPrompt', 'string'],
				['clearPoolsOnEnd', 'string[]'],
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
		if (!this.isOnActor) return;
		if (this.disabled) return;
		const effect = findToggleEffect(this.#actor, this.id);
		if (!effect || effect.disabled) return;
		for (const tag of this.tags) this.#actor.tags.add(tag);
	}

	/**
	 * Item activation only turns the toggle ON, never off, so using the item again while the toggle
	 * is on cannot drop it by mistake.
	 */
	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (context.sourceItem !== this.parentItem) return;
		if (!this.isOnActor) return;
		if (!this.test()) return;
		await turnToggleOn(this.#actor, this.#item, this);
	}

	override async onTurnStart(context: TurnContext): Promise<void> {
		await this.#maybeAutoTurnOn('onTurnStart', context.actor);
	}

	override async onActorDying(context: ActorDyingContext): Promise<void> {
		await this.#maybeAutoTurnOn('onActorDying', context.actor);
	}

	override async onAttackReceived(context: ItemUsedContext): Promise<void> {
		if (!firesCritTriggers(context)) return;
		await this.#maybeAutoTurnOn('onCritReceived', context.targetActor);
	}

	/**
	 * Switch the toggle ON when a sibling modifyToggle rule requests it for the event (with that
	 * rule's predicate). GM-gated so the flip and its announcement happen on one client. It restores
	 * the toggle's state only; it does not run the owning item's activation effects.
	 */
	async #maybeAutoTurnOn(event: TurnOnEvent, actor: unknown): Promise<void> {
		if (actor !== this.actor) return;
		if (this.disabled) return;
		if (!this.#hasTurnOnRequest(event)) return;
		if (!isActiveGM()) return;
		if (!(await turnToggleOn(this.#actor, this.#item, this))) return;
		await this.#announceStart(localize(`NIMBLE.rules.toggleEffect.startReasons.${event}`));
	}

	#hasTurnOnRequest(event: TurnOnEvent): boolean {
		return modifyToggleRulesFor<{ turnOn?: string[] }>(this.actor as never, this).some((rule) =>
			(rule.turnOn ?? []).includes(event),
		);
	}

	/** Chat failure must not break the turn-on itself. */
	async #announceStart(reason: string): Promise<void> {
		if (!isChatNotificationsAutomationEnabled()) return;
		const actor = this.actor as unknown as Actor | null;
		if (!actor) return;
		const name = this.label || this.parentItem.name;
		try {
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor }),
				content: `<p>${localize('NIMBLE.rules.toggleEffect.startedMessage', { name, reason })}</p>`,
			} as unknown as ChatMessage.CreateData);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn('Nimble | toggleEffect start announcement failed', error);
		}
	}

	get #actor(): ActorWithEffects {
		return this.actor as unknown as ActorWithEffects;
	}

	get #item(): ToggleItemLike {
		return this.parentItem as unknown as ToggleItemLike;
	}

	/**
	 * Foundry does not delete effects by origin, so without this the AE would stay on the actor
	 * with no rule left to turn it off.
	 */
	async afterDelete(): Promise<void> {
		if (!this.isOnActor) return;
		const existing = findToggleEffect(this.#actor, this.id);
		if (!existing?.id) return;
		await this.#actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
	}
}

export {
	ToggleEffectRule,
	TURN_ON_CHOICES,
	TOGGLE_EFFECT_RULE_ID_FLAG,
	TOGGLE_EFFECT_ITEM_ID_FLAG,
	type TurnOnEvent,
};
