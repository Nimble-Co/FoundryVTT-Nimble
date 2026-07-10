import { SYSTEM_ID } from '#system';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import localize from '#utils/localize.js';
import {
	type ActorHealthContext,
	type EncounterEndContext,
	type ItemActivatedContext,
	NimbleBaseRule,
	type RestContext,
	type RoundChangedContext,
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
	declare endAfterInactiveRounds: number | null;

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

	override async onUnconscious(context: UnconsciousContext): Promise<void> {
		await this.#maybeTurnOff('onUnconscious', context.actor);
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
		if (!game.users?.activeGM?.isSelf) return;
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

		if (!game.users?.activeGM?.isSelf) return;

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
