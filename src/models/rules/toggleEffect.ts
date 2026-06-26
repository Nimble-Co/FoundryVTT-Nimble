import { SYSTEM_ID } from '#system';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import localize from '#utils/localize.js';
import {
	computeNextToggledList,
	getCurrentWorldTime,
	readToggledEffects,
	TOGGLED_EFFECTS_FLAG_KEY,
	type ToggledTargetEntry,
} from '#utils/toggledEffects.js';
import {
	type ActorDyingContext,
	type ActorHealthContext,
	type EncounterEndContext,
	type ItemActivatedContext,
	NimbleBaseRule,
	type RestContext,
	type RoundChangedContext,
	type TurnContext,
} from './base.js';

const TURN_OFF_CHOICES = [
	'onActorKilled',
	'onActorWounded',
	'onRest',
	'onTurnStart',
	'onTurnEnd',
	'onEncounterEnd',
	'onActorDying',
] as const;

type TurnOffEvent = (typeof TURN_OFF_CHOICES)[number];

const TOGGLE_EFFECT_RULE_ID_FLAG = 'toggleEffectRuleId';
const TOGGLE_EFFECT_ITEM_ID_FLAG = 'toggleEffectItemId';
// Inactivity tracking (endAfterInactiveRounds): round and combat id of the
// last qualifying activity, stored on the backing AE so the state lives and
// dies with the toggle.
const TOGGLE_EFFECT_ACTIVITY_ROUND_FLAG = 'toggleEffectActivityRound';
const TOGGLE_EFFECT_ACTIVITY_COMBAT_FLAG = 'toggleEffectActivityCombatId';

interface ToggleEffectAEItemSource {
	id: string;
	name: string;
	img?: string;
	uuid?: string;
}

/**
 * Canonical creation payload for a toggleEffect backing AE. Shared by the
 * rule's activation path and the UI switch path (toggleEffectControl) so the
 * flag shape and origin stamping never drift between the two.
 */
function buildToggleEffectAEData(
	item: ToggleEffectAEItemSource,
	ruleId: string,
	label = '',
): Record<string, unknown> {
	return {
		name: label || item.name,
		img: item.img,
		disabled: false,
		// Origin lets Foundry surface the source item in the effects
		// panel and lets downstream cleanup follow item deletion.
		origin: item.uuid,
		flags: {
			[SYSTEM_ID]: {
				[TOGGLE_EFFECT_RULE_ID_FLAG]: ruleId,
				[TOGGLE_EFFECT_ITEM_ID_FLAG]: item.id,
			},
		},
	};
}

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
		// Confirm-end dialog content: plain text or an i18n key, so homebrew
		// items can set a prompt without shipping translation files. Empty =
		// no prompt (turn-off triggers and the effects-panel toggle path
		// never prompt; only the explicit on/off switch consults this).
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
		// Rounds of combat inactivity after which the toggle ends at the
		// actor's turn end. Activity = re-activating the owning item or
		// activating any item whose activation carries a damage effect
		// (an attack). Null disables the mechanic. Models rules like
		// Berserker Rage's "ends after 1 round without attacking or Raging".
		endAfterInactiveRounds: new fields.NumberField({
			required: false,
			nullable: true,
			initial: null,
			integer: true,
			min: 1,
			label: 'NIMBLE.rules.toggleEffect.endAfterInactiveRounds.label',
			hint: 'NIMBLE.rules.toggleEffect.endAfterInactiveRounds.hint',
		}),
		// --- Target-marking extension ---------------------------------------
		// When `flagKey` is non-empty, activating the owning item records the
		// activation's target(s) relationally on this actor (e.g. a Hunter's
		// quarry), exposing a `target:<flagKey>` predicate tag that resolves
		// only for this actor. Independent of the self-effect toggle above; a
		// rule may do either or both.
		flagKey: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.toggleEffect.flagKey.label',
			hint: 'NIMBLE.rules.toggleEffect.flagKey.hint',
		}),
		statusCondition: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.toggleEffect.statusCondition.label',
			hint: 'NIMBLE.rules.toggleEffect.statusCondition.hint',
			choices: () => CONFIG.NIMBLE.conditions,
		}),
		maxTargets: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 1,
			label: 'NIMBLE.rules.toggleEffect.maxTargets.label',
			hint: 'NIMBLE.rules.toggleEffect.maxTargets.hint',
		}),
		durationDays: new fields.NumberField({
			required: false,
			nullable: true,
			min: 0,
			initial: null,
			label: 'NIMBLE.rules.toggleEffect.durationDays.label',
			hint: 'NIMBLE.rules.toggleEffect.durationDays.hint',
		}),
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

interface StatusEffectActor {
	toggleStatusEffect(
		statusId: string,
		options?: { active?: boolean; overlay?: boolean },
	): Promise<unknown>;
}

interface MarkingActor {
	uuid: string;
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
	rules?: NimbleBaseRule[];
}

class ToggleEffectRule extends NimbleBaseRule<ToggleEffectRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.toggleEffect.description';

	declare tags: string[];
	declare turnOff: TurnOffEvent[];
	declare confirmEndPrompt: string;
	declare clearPoolsOnEnd: string[];
	declare endAfterInactiveRounds: number | null;
	declare flagKey: string;
	// `statusCondition` is intentionally not re-declared: its type is inferred
	// from the schema's `choices` (condition keys plus the blank sentinel), and
	// widening it to `string` here would clash with that inferred type.
	declare maxTargets: number;
	declare durationDays: number | null;

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
				['endAfterInactiveRounds', 'number | null'],
				['flagKey', 'string'],
				['statusCondition', 'string'],
				['maxTargets', 'number'],
				['durationDays', 'number | null'],
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
		if (context.sourceItem !== this.item) {
			// A different item on the same actor was activated. If it carries a
			// damage effect, that's an attack: record it as activity for the
			// inactivity timer.
			if (this.endAfterInactiveRounds && ToggleEffectRule.#isAttackActivation(context)) {
				await this.#recordActivity();
			}
			return;
		}
		if (!this.test()) return;

		// Target-marking extension: record the activation's target(s)
		// relationally (e.g. a Hunter's quarry) so `target:<flagKey>` predicates
		// resolve for this actor. Runs independently of the self-effect toggle.
		if (this.flagKey) await this.#markTargets(context);

		// The backing ActiveEffect only applies when this rule is configured as a
		// self toggle (tags / turn-off / linked pools / inactivity / end prompt).
		// A pure marking rule leaves those empty and creates no backing effect.
		if (!this.#hasSelfToggle()) return;

		const existing = this.#findActiveEffect();
		if (!existing) {
			await this.#createActiveEffect();
			return;
		}
		if (existing.disabled) {
			await existing.update({ disabled: false });
			return;
		}
		// Re-activating the owning item while already on (e.g. Raging again
		// mid-Rage) counts as activity.
		if (this.endAfterInactiveRounds) {
			await this.#recordActivity();
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
		await this.#maybeEndFromInactivity(context);
	}

	override async onEncounterEnd(context: EncounterEndContext): Promise<void> {
		await this.#maybeTurnOff('onEncounterEnd', context.actor);
	}

	override async onActorDying(context: ActorDyingContext): Promise<void> {
		await this.#maybeTurnOff('onActorDying', context.actor);
	}

	/**
	 * Keep the inactivity clock honest across round rewinds. When the round
	 * counter moves below the stamped activity round, that stamped activity
	 * belongs to an undone timeline: clamp it to the new round immediately
	 * so the replayed rounds are tracked afresh. This complements the same
	 * clamp in the turn-end check, which only runs when the owning actor's
	 * turn boundary actually replays.
	 */
	override async onRoundChanged(context: RoundChangedContext): Promise<void> {
		if (context.actor !== this.actor) return;
		if (!this.endAfterInactiveRounds) return;
		if (!isActiveGM()) return;
		const existing = this.#findActiveEffect();
		if (!existing) return;

		const combat = context.combat as unknown as { id?: string | null };
		const combatId = combat?.id ?? null;
		if (!combatId) return;

		const recordedCombatId = existing.getFlag(SYSTEM_ID, TOGGLE_EFFECT_ACTIVITY_COMBAT_FLAG);
		const recordedRound = existing.getFlag(SYSTEM_ID, TOGGLE_EFFECT_ACTIVITY_ROUND_FLAG);
		if (recordedCombatId !== combatId || typeof recordedRound !== 'number') return;

		if (recordedRound > context.round) {
			await this.#stampActivity(existing, combatId, context.round);
		}
	}

	async #maybeTurnOff(event: TurnOffEvent, actor: unknown): Promise<void> {
		if (actor !== this.actor) return;
		if (!this.turnOff.includes(event)) return;
		if (this.#isTurnOffSuppressed(event)) return;
		const existing = this.#findActiveEffect();
		if (!existing) return;
		// Delete/pool-clear/announce must happen on exactly one client.
		if (!isActiveGM()) return;
		await this.#clearLinkedPools();
		await this.#deleteActiveEffect(existing.id);
		await this.#announceEnd(localize(`NIMBLE.rules.toggleEffect.endReasons.${event}`));
	}

	/**
	 * True when a sibling modifyToggle rule (on any of the actor's items)
	 * suppresses the given turn-off event for this toggle. Lets features
	 * modify a toggle's lifecycle the same way modifyPool modifies a pool,
	 * e.g. Berserker Deep Rage suppressing onActorKilled.
	 */
	#isTurnOffSuppressed(event: TurnOffEvent): boolean {
		const actor = this.actor as unknown as {
			items?: { contents?: Array<{ rules?: { values: () => Iterable<unknown> } }> };
		} | null;
		const items = actor?.items?.contents ?? [];
		const targetIds = new Set([this.identifier, this.id].filter((v) => v && v.length > 0));

		for (const item of items) {
			const rules = item.rules;
			if (!rules || typeof rules.values !== 'function') continue;
			for (const rule of rules.values()) {
				const modifier = rule as {
					type?: string;
					disabled?: boolean;
					toggleIdentifier?: string;
					suppressTurnOff?: string[];
					appliesTo?: () => boolean;
				};
				if (modifier.type !== 'modifyToggle' || modifier.disabled) continue;
				const toggleIdentifier = modifier.toggleIdentifier?.trim() ?? '';
				if (!targetIds.has(toggleIdentifier)) continue;
				if (typeof modifier.appliesTo === 'function' && !modifier.appliesTo()) continue;
				if ((modifier.suppressTurnOff ?? []).includes(event)) return true;
			}
		}

		return false;
	}

	/**
	 * End the toggle at the actor's turn end when `endAfterInactiveRounds`
	 * rounds passed without qualifying activity. The first turn-end check in
	 * a combat with no recorded activity stamps a grace baseline instead of
	 * ending immediately (covers toggles switched on before combat started).
	 *
	 * Whether the round really was inactive is a table judgment, so the end
	 * is adjudicated by the active GM: the check runs only on the GM's
	 * client, which gets a confirm dialog. Declining resets the inactivity
	 * clock so the prompt returns only after another inactive round.
	 */
	async #maybeEndFromInactivity(context: TurnContext): Promise<void> {
		if (context.actor !== this.actor) return;
		const inactiveRounds = this.endAfterInactiveRounds;
		if (!inactiveRounds) return;
		const existing = this.#findActiveEffect();
		if (!existing) return;

		const combat = context.combat as unknown as { id?: string | null; round?: number };
		const combatId = combat?.id ?? null;
		const round = combat?.round ?? 0;
		if (!combatId) return;

		if (!isActiveGM()) return;

		const recordedCombatId = existing.getFlag(SYSTEM_ID, TOGGLE_EFFECT_ACTIVITY_COMBAT_FLAG);
		const recordedRound = existing.getFlag(SYSTEM_ID, TOGGLE_EFFECT_ACTIVITY_ROUND_FLAG);

		if (recordedCombatId !== combatId || typeof recordedRound !== 'number') {
			await this.#stampActivity(existing, combatId, round);
			return;
		}

		// A stamp from a later round than the current one means the GM
		// rewound the combat past it (e.g. a decline-stamp at round 2
		// followed by stepping back to round 1). That stamped activity was
		// undone, so reset the clock to the current round and track the
		// replayed rounds afresh.
		if (recordedRound > round) {
			await this.#stampActivity(existing, combatId, round);
			return;
		}

		if (round - recordedRound < inactiveRounds) return;

		const name = this.label || (this.item as unknown as { name: string }).name;
		const actorName = (this.actor as unknown as { name?: string })?.name ?? '';
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: {
				title: localize('NIMBLE.rules.toggleEffect.confirmDialogTitle', { name }),
			},
			content: `<p>${localize('NIMBLE.rules.toggleEffect.inactivityPrompt', {
				actor: actorName,
				name,
				rounds: String(inactiveRounds),
			})}</p>`,
			yes: { label: localize('NIMBLE.rules.toggleEffect.confirmDialogConfirm') },
			no: { label: localize('NIMBLE.rules.toggleEffect.confirmDialogCancel') },
			rejectClose: false,
		});

		if (confirmed !== true) {
			await this.#stampActivity(existing, combatId, round);
			return;
		}

		await this.#clearLinkedPools();
		await this.#deleteActiveEffect(existing.id);
		await this.#announceEnd(
			localize('NIMBLE.rules.toggleEffect.endReasons.inactivity', {
				rounds: String(inactiveRounds),
			}),
		);
	}

	/**
	 * Post a chat message explaining an automatic toggle end. Runs only
	 * after the AE deletion succeeded, so with multiple connected clients
	 * only the client that won the delete announces. Chat failure must not
	 * break the turn-off itself.
	 */
	async #announceEnd(reason: string): Promise<void> {
		const actor = this.actor as unknown as Actor | null;
		if (!actor) return;
		const name = this.label || (this.item as unknown as { name: string }).name;
		try {
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor }),
				content: `<p>${localize('NIMBLE.rules.toggleEffect.endedMessage', { name, reason })}</p>`,
			} as unknown as ChatMessage.CreateData);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn('Nimble | toggleEffect end announcement failed', error);
		}
	}

	/**
	 * Record qualifying activity (owning-item activation or an attack) on the
	 * backing AE. No-ops outside an active combat: the inactivity clock only
	 * runs in combat, and leaving combat is handled by onEncounterEnd.
	 */
	async #recordActivity(): Promise<void> {
		const existing = this.#findActiveEffect();
		if (!existing) return;
		const combat = game.combat as unknown as {
			id?: string | null;
			round?: number;
			started?: boolean;
		} | null;
		if (!combat?.started || !combat.id) return;
		await this.#stampActivity(existing, combat.id, combat.round ?? 0);
	}

	async #stampActivity(effect: ActiveEffectLike, combatId: string, round: number): Promise<void> {
		await effect.update({
			[`flags.${SYSTEM_ID}.${TOGGLE_EFFECT_ACTIVITY_COMBAT_FLAG}`]: combatId,
			[`flags.${SYSTEM_ID}.${TOGGLE_EFFECT_ACTIVITY_ROUND_FLAG}`]: round,
		});
	}

	/**
	 * An activation counts as an attack when the item's activation carries at
	 * least one damage effect. Damaging spells count; pure-utility, healing,
	 * and pool actions do not.
	 */
	static #isAttackActivation(context: ItemActivatedContext): boolean {
		const item = context.sourceItem as unknown as {
			system?: { activation?: { effects?: Array<{ type?: string }> } };
		};
		const effects = item?.system?.activation?.effects ?? [];
		return effects.some((effect) => effect?.type === 'damage');
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
		const item = this.item as unknown as ToggleEffectAEItemSource;
		await actor.createEmbeddedDocuments('ActiveEffect', [
			buildToggleEffectAEData(item, this.id, this.label),
		]);
	}

	async #deleteActiveEffect(id: string): Promise<void> {
		const actor = this.actor as unknown as ActorWithEffects;
		await actor.deleteEmbeddedDocuments('ActiveEffect', [id]);
	}

	/** True when this rule is configured as a self-effect toggle (vs. pure target-marking). */
	#hasSelfToggle(): boolean {
		return (
			this.tags.length > 0 ||
			this.turnOff.length > 0 ||
			this.clearPoolsOnEnd.length > 0 ||
			this.endAfterInactiveRounds !== null ||
			this.confirmEndPrompt.trim().length > 0
		);
	}

	/**
	 * Capacity for this flag key: the largest `maxTargets` among this actor's
	 * enabled toggleEffect rules sharing the key whose predicate currently
	 * passes. A 0 on any contributor means unlimited (returned as 0). Lets an
	 * upgrade feature raise the cap (e.g. the Hunter's level-20 Nemesis) without
	 * the base rule knowing about it.
	 */
	#resolveCapacity(): number {
		const rules = (this.actor as object as MarkingActor).rules ?? [];
		let capacity = this.maxTargets;
		for (const rule of rules) {
			if (rule.type !== 'toggleEffect') continue;
			const other = rule as unknown as ToggleEffectRule;
			if (other.flagKey !== this.flagKey) continue;
			if (!other.appliesTo()) continue;
			if (other.maxTargets === 0) return 0;
			capacity = Math.max(capacity, other.maxTargets);
		}
		return capacity;
	}

	/**
	 * Record the activation's target(s) on this actor's toggled-effects flag,
	 * enforcing capacity (oldest evicted) and applying the optional status
	 * condition to each marked target.
	 */
	async #markTargets(context: ItemActivatedContext): Promise<void> {
		if (!this.item.isEmbedded) return;

		// Pair each target token with its actor; tokenless targets keep a null token uuid.
		const targets: Array<{
			actor: { uuid: string; name?: string } & StatusEffectActor;
			tokenUuid: string | null;
		}> = [];
		for (const tokenDoc of context.targetTokens ?? []) {
			const actor = (tokenDoc as { actor?: unknown }).actor as
				| ({ uuid: string; name?: string } & StatusEffectActor)
				| null
				| undefined;
			if (!actor?.uuid) continue;
			targets.push({ actor, tokenUuid: (tokenDoc as { uuid?: string }).uuid ?? null });
		}
		if (targets.length === 0) return;

		const owner = this.actor as object as MarkingActor;
		const capacity = this.#resolveCapacity();
		const now = getCurrentWorldTime();

		const flag = { ...readToggledEffects(owner) };
		let list = Array.isArray(flag[this.flagKey]) ? [...flag[this.flagKey]] : [];
		const evicted: ToggledTargetEntry[] = [];

		for (const { actor, tokenUuid } of targets) {
			const entry: ToggledTargetEntry = {
				actorUuid: actor.uuid,
				tokenUuid,
				name: actor.name ?? '',
				markedAt: now,
				durationDays: this.durationDays,
			};
			const next = computeNextToggledList(list, entry, capacity, now);
			list = next.list;
			evicted.push(...next.evicted);
		}

		flag[this.flagKey] = list;
		await owner.setFlag(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, flag);

		await this.#applyMarkStatus(targets, evicted);
	}

	/** Applies the visible status to freshly marked targets and clears it from evicted ones. */
	async #applyMarkStatus(
		targets: Array<{ actor: StatusEffectActor }>,
		evicted: ToggledTargetEntry[],
	): Promise<void> {
		if (!this.statusCondition) return;

		for (const { actor } of targets) {
			await actor.toggleStatusEffect(this.statusCondition, { active: true });
		}

		for (const entry of evicted) {
			if (!entry.tokenUuid) continue;
			const tokenDoc = (await fromUuid(entry.tokenUuid as Parameters<typeof fromUuid>[0])) as {
				actor?: StatusEffectActor;
			} | null;
			const actor = tokenDoc?.actor;
			if (!actor) continue;
			await actor.toggleStatusEffect(this.statusCondition, { active: false });
		}
	}

	/**
	 * Lifecycle cleanup when the owning item is deleted. The backing AE's
	 * origin points at the item, but Foundry does not cascade-delete effects
	 * by origin, so without this the AE would be stranded on the actor with
	 * no rule left to turn it off.
	 */
	async afterDelete(): Promise<void> {
		if (!this.item.isEmbedded) return;
		const existing = this.#findActiveEffect();
		if (!existing) return;
		await this.#deleteActiveEffect(existing.id);
	}
}

export {
	ToggleEffectRule,
	TURN_OFF_CHOICES,
	TOGGLE_EFFECT_RULE_ID_FLAG,
	TOGGLE_EFFECT_ITEM_ID_FLAG,
	buildToggleEffectAEData,
	type TurnOffEvent,
};
