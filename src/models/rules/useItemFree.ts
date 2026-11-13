import { ruleKey, ruleLabel } from '#utils/actor/actorRules.js';
import { isEnemyAttacker } from '#utils/actor/isEnemyAttacker.js';
import { useItemForFree } from '#utils/actor/useItemForFree.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { firesCritTriggers } from '#utils/reroll/firesCritTriggers.js';
import { cardAttackOutcome } from '#utils/rolls/cardAttackOutcome.js';
import type { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import { choiceLabels } from './_rollUseRule.js';
import {
	attackOutcomeMatches,
	isAttackOutcomeTrigger,
	RULE_TRIGGERS,
	type RuleTrigger,
} from './_triggers.js';
import {
	type ActorDyingContext,
	type ActorHealthContext,
	type InitiativeRolledContext,
	type ItemActivatedContext,
	type ItemUsedContext,
	NimbleBaseRule,
	type RestContext,
	type SaveResolvedContext,
	type TurnContext,
} from './base.js';

const WORDS = 'NIMBLE.rules.useItemFree';

// A free use is always free of actions; the activation adds 'action'.
const FREE_OF_CHOICES = ['uses', 'mana'] as const satisfies readonly ItemActivationManager.FreeOf[];

// These events reach every client, so only the active GM acts on them.
const EVERY_CLIENT_TRIGGERS: ReadonlySet<RuleTrigger> = new Set(['onKill', 'onWound', 'onDying']);

// One free use for each card, though a card can reach the rule once for each target. Only the
// newest keys are kept: a card reaches the rule soon after it is made.
const usedForCard = new Set<string>();
const USED_FOR_CARD_KEPT = 200;
const inFlight = new Set<string>();

function markUsedForCard(key: string): void {
	usedForCard.add(key);
	if (usedForCard.size <= USED_FOR_CARD_KEPT) return;
	const oldest = usedForCard.values().next().value;
	if (oldest !== undefined) usedForCard.delete(oldest);
}

interface IdentifiedItem {
	identifier?: string;
	system?: { identifier?: string };
}

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'useItemFree' }),
		itemIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: `${WORDS}.itemIdentifier.label`,
			hint: `${WORDS}.itemIdentifier.hint`,
		}),
		triggers: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: 'onTurnStart',
				choices: choiceLabels('useItemFree', 'triggers', RULE_TRIGGERS),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: `${WORDS}.triggers.label`,
				hint: `${WORDS}.triggers.hint`,
			} as unknown as never,
		),
		freeOf: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: 'uses',
				choices: choiceLabels('useItemFree', 'freeOf', FREE_OF_CHOICES),
			}),
			{
				required: true,
				nullable: false,
				initial: ['uses', 'mana'],
				label: `${WORDS}.freeOf.label`,
				hint: `${WORDS}.freeOf.hint`,
			} as unknown as never,
		),
	};
}

declare namespace UseItemFreeRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * On each of its triggers, while its predicate passes, the actor uses the item named by
 * `itemIdentifier` with no window and no action spent, and per `freeOf` with no use limit and no
 * mana. The outcome of the actor's own attack is read from the attack card when it is made.
 */
class UseItemFreeRule extends NimbleBaseRule<UseItemFreeRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-forward';

	declare itemIdentifier: string;
	declare triggers: RuleTrigger[];
	declare freeOf: ItemActivationManager.FreeOf[];

	static override defineSchema(): UseItemFreeRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		const join = (values: readonly string[]) =>
			values
				.map((value) => `'${value}'`)
				.join(' <span class="nimble-type-summary__operator">|</span> ');
		return super.tooltipInfo(
			new Map([
				['itemIdentifier', 'string'],
				['triggers', join(RULE_TRIGGERS)],
				['freeOf', join(FREE_OF_CHOICES)],
			]),
		);
	}

	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (context.sourceActor !== this.actor || !context.card) return;
		if (this.#usesItself(context.sourceItem)) return;
		const outcome = cardAttackOutcome(context.card);
		if (!outcome) return;
		for (const trigger of this.triggers) {
			if (!isAttackOutcomeTrigger(trigger) || !attackOutcomeMatches(trigger, outcome)) continue;
			await this.#useOnce(trigger, context.card);
		}
	}

	override async onAttackReceived(context: ItemUsedContext): Promise<void> {
		if (context.targetActor !== this.actor) return;
		if (!firesCritTriggers(context)) return;
		if (!isEnemyAttacker(context.sourceActor, this.actor, context.card)) return;
		await this.#useOnce('onCritReceived', context.card);
	}

	override async onActiveGmTurnStart(context: TurnContext): Promise<void> {
		await this.#on('onTurnStart', context.actor);
	}

	override async onTurnEnd(context: TurnContext): Promise<void> {
		await this.#on('onTurnEnd', context.actor);
	}

	override async onActorKilled(context: ActorHealthContext): Promise<void> {
		await this.#on('onKill', context.actor);
	}

	override async onActorWounded(context: ActorHealthContext): Promise<void> {
		await this.#on('onWound', context.actor);
	}

	override async onSaveResolved(context: SaveResolvedContext): Promise<void> {
		if (context.outcome !== 'fail') return;
		await this.#on('onSaveFail', context.actor);
	}

	override async onRest(context: RestContext): Promise<void> {
		await this.#on('onRest', context.actor);
	}

	override async onInitiativeRolled(context: InitiativeRolledContext): Promise<void> {
		await this.#on('onInitiative', context.actor);
	}

	override async onActorDying(context: ActorDyingContext): Promise<void> {
		await this.#on('onDying', context.actor);
	}

	/** A use of the item this rule uses does not set off the rule again. */
	#usesItself(item: unknown): boolean {
		const used = item as IdentifiedItem | null;
		const identifier = used?.identifier || used?.system?.identifier || '';
		return !!identifier && identifier === this.itemIdentifier.trim();
	}

	async #on(trigger: RuleTrigger, actor: unknown): Promise<void> {
		if (actor !== this.actor) return;
		await this.#use(trigger);
	}

	async #useOnce(trigger: RuleTrigger, card: ChatMessage | null): Promise<void> {
		const cardId = card?.id;
		if (!cardId) {
			await this.#use(trigger);
			return;
		}
		const key = `${ruleKey(this)}:${trigger}:${cardId}`;
		if (usedForCard.has(key) || !this.#fires(trigger)) return;
		markUsedForCard(key);
		await this.#use(trigger, cardId);
	}

	#fires(trigger: RuleTrigger): boolean {
		if (!this.triggers.includes(trigger)) return false;
		if (!this.itemIdentifier.trim()) return false;
		if (EVERY_CLIENT_TRIGGERS.has(trigger) && !isActiveGM()) return false;
		return this.isOnActor && this.test();
	}

	async #use(trigger: RuleTrigger, cardId?: string): Promise<void> {
		if (!this.#fires(trigger)) return;
		const key = [ruleKey(this), trigger, ...(cardId ? [cardId] : [])].join(':');
		if (inFlight.has(key)) return;
		inFlight.add(key);
		try {
			await useItemForFree(this.actor as never, this.itemIdentifier.trim(), {
				of: [...this.freeOf],
				reason: {
					key: `${WORDS}.cardLine`,
					data: { trigger: { key: `${WORDS}.reasons.${trigger}` }, feature: ruleLabel(this) },
				},
			});
		} finally {
			inFlight.delete(key);
		}
	}
}

export { UseItemFreeRule };
