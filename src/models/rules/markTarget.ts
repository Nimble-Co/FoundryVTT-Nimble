import { SYSTEM_ID } from '#system';
import type { MeasurableTokenDocument } from '#types/movement.js';
import { rulesOfType } from '#utils/actor/actorRules.js';
import { payloadFromEffect } from '#utils/actor/applyEffectToActor.js';
import { itemEffectOf } from '#utils/actor/itemEffectOf.js';
import {
	applyMarkEffect,
	MARK_TARGET_ITEM_FLAG,
	removeMarkEffect,
} from '#utils/actor/markTargetEffects.js';
import {
	computeNextToggledList,
	readToggledEffects,
	TOGGLED_EFFECTS_FLAG_KEY,
	type ToggledTargetEntry,
} from '#utils/actor/toggledEffects.js';
import localize from '#utils/localize.js';
import { spacesBetween } from '#utils/movement/spacesBetween.js';
import { NIMBLE_EFFECT_TYPE } from '../activeEffect/nimbleEffectChoices.js';
import { withWidget } from './_widgetOption.js';
import { type ItemActivatedContext, NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'markTarget' }),
		flagKey: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'quarry',
			label: 'NIMBLE.rules.markTarget.flagKey.label',
			hint: 'NIMBLE.rules.markTarget.flagKey.hint',
		}),
		statusCondition: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.markTarget.statusCondition.label',
			hint: 'NIMBLE.rules.markTarget.statusCondition.hint',
			choices: () => CONFIG.NIMBLE.conditions,
		}),
		maxTargets: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 1,
			label: 'NIMBLE.rules.markTarget.maxTargets.label',
			hint: 'NIMBLE.rules.markTarget.maxTargets.hint',
		}),
		endEarlier: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.markTarget.endEarlier.label',
			hint: 'NIMBLE.rules.markTarget.endEarlier.hint',
		}),
		effectId: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.markTarget.effectId.label',
				hint: 'NIMBLE.rules.markTarget.effectId.hint',
				widget: 'itemEffectPicker',
			}),
		),
	};
}

declare namespace MarkTargetRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface MarkEffect {
	id: string;
	getFlag(scope: string, key: string): unknown;
}

interface MarkableActor {
	uuid: string;
	name?: string;
	effects: Iterable<MarkEffect>;
	createEmbeddedDocuments(
		type: 'ActiveEffect',
		data: Array<Record<string, unknown>>,
	): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
	updateEmbeddedDocuments(
		type: 'ActiveEffect',
		updates: Array<Record<string, unknown>>,
	): Promise<unknown>;
}

interface MarkSourceEffect {
	transfer?: boolean;
	toObject(): Record<string, unknown>;
}

interface FlaggedActor {
	uuid: string;
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
	rules?: NimbleBaseRule[];
}

/** A token the extra-mark offer can measure. The scene's tokens are the candidates. */
interface AdditionalMarkToken {
	uuid?: string;
	name?: string;
	hidden?: boolean;
	actor?: { uuid?: string; name?: string } | null;
	parent?: { tokens?: Iterable<AdditionalMarkToken> } | null;
}

const DECLINE_ADDITIONAL_MARK = 'decline';

/** The first additional-mark offer that follows this flag, or null when none applies. */
function additionalMarkWithin(actor: FlaggedActor, flagKey: string): number | null {
	for (const rule of rulesOfType(actor, 'additionalMark')) {
		if (rule.flagKey !== flagKey) continue;
		if (!rule.isOnActor || !rule.appliesTo()) continue;
		if (!Number.isInteger(rule.within) || rule.within < 1) continue;
		return rule.within;
	}
	return null;
}

function creatureAction(token: AdditionalMarkToken): string {
	return `mark:${token.uuid || token.actor?.uuid || ''}`;
}

/** Creatures on the new mark's scene, within `within` spaces, other than the excluded actors. */
function creaturesWithinMark(
	origin: AdditionalMarkToken,
	within: number,
	excludeActorUuids: Set<string>,
): AdditionalMarkToken[] {
	const tokens = origin.parent?.tokens;
	if (!tokens) return [];

	const seen = new Set<string>();
	const eligible: AdditionalMarkToken[] = [];
	for (const token of tokens) {
		if (token.hidden) continue;
		const actorUuid = token.actor?.uuid;
		if (!actorUuid || excludeActorUuids.has(actorUuid) || seen.has(actorUuid)) continue;
		const spaces = spacesBetween(
			origin as MeasurableTokenDocument,
			token as MeasurableTokenDocument,
			undefined,
			within,
		);
		if (spaces > within) continue;
		seen.add(actorUuid);
		eligible.push(token);
	}
	return eligible;
}

/** The chosen creature's button action, or null when the player declines or dismisses. */
async function promptForAdditionalCreature(
	candidates: AdditionalMarkToken[],
	within: number,
): Promise<string | null> {
	const buttons = candidates.map((token) => ({
		action: creatureAction(token),
		label: token.name || token.actor?.name || localize('NIMBLE.mark.additional.unnamed'),
	}));

	const chosen = await foundry.applications.api.DialogV2.wait({
		window: { title: localize('NIMBLE.mark.additional.title') },
		content: `<p>${localize('NIMBLE.mark.additional.content', { spaces: String(within) })}</p>`,
		buttons: [
			...buttons,
			{
				action: DECLINE_ADDITIONAL_MARK,
				label: localize('NIMBLE.mark.additional.decline'),
			},
		],
		rejectClose: false,
	});

	if (typeof chosen !== 'string' || chosen === DECLINE_ADDITIONAL_MARK) return null;
	return buttons.some((button) => button.action === chosen) ? chosen : null;
}

/**
 * Offers one more creature after a mark that ends every earlier mark. Writing the
 * choice here, instead of activating an item, spends no action and no charges and
 * does not ask again. `list` is the mark list just written: this flag key is not
 * read back, so a stale flag cannot restore the marks that just ended.
 */
async function offerAdditionalMark(args: {
	actor: FlaggedActor;
	flagKey: string;
	list: ToggledTargetEntry[];
	markedActorUuid: string;
	markedToken: AdditionalMarkToken | null;
	applyMarker: (actor: MarkableActor) => Promise<void>;
}): Promise<void> {
	const within = additionalMarkWithin(args.actor, args.flagKey);
	const origin = args.markedToken;
	if (within === null || !origin) return;

	const candidates = creaturesWithinMark(
		origin,
		within,
		new Set([args.actor.uuid, args.markedActorUuid]),
	);
	if (candidates.length === 0) return;

	const chosen = await promptForAdditionalCreature(candidates, within);
	if (!chosen) return;

	const token = candidates.find((candidate) => creatureAction(candidate) === chosen);
	const actor = token?.actor as MarkableActor | null | undefined;
	if (!token || !actor?.uuid) return;

	const entry: ToggledTargetEntry = {
		actorUuid: actor.uuid,
		tokenUuid: token.uuid ?? null,
		name: actor.name || token.name || localize('NIMBLE.mark.additional.unnamed'),
	};
	const flag = { ...readToggledEffects(args.actor) };
	const list = args.list.filter((existing) => existing.actorUuid !== entry.actorUuid);
	list.push(entry);
	flag[args.flagKey] = list;
	await args.actor.setFlag(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, flag);
	await args.applyMarker(actor);
}

/**
 * Records one or more target creatures on the owning actor as a tracked mark (e.g. a
 * Hunter's quarry). Marks are stored relationally on the *marking* actor under
 * `flags.<system>.toggledEffects.<flagKey>`, so the matching `target:<flagKey>` predicate
 * tag resolves only for that actor when it attacks.
 *
 * An optional `statusCondition` is applied to each marked target as a visible token
 * marker — one ActiveEffect per marker, so concurrent marks from different hunters stay
 * independent. Capacity is the largest `maxTargets` among the actor's enabled markTarget rules
 * sharing this `flagKey` (a value of 0 means unlimited) — this lets a separate upgrade
 * feature raise the cap (e.g. the Hunter's level-20 Nemesis) without the primary rule
 * knowing about it. Marking beyond capacity evicts the oldest mark. With `endEarlier`, a new
 * mark ends every earlier mark of this flag instead, unless capacity is unlimited. An
 * `additionalMark` rule can then offer one more creature within range of that new mark,
 * without using the item again. An `effectId` gives the marker the
 * item effect's Lasts Until, changes and rules. Any end of the marker (its Lasts Until, or
 * someone taking it off the creature) ends that mark (see `markLifecycle.ts`).
 */
class MarkTargetRule extends NimbleBaseRule<MarkTargetRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.markTarget.description';

	declare flagKey: string;
	// `statusCondition` is inferred from the schema's `choices` (condition keys plus the
	// blank sentinel). Re-declaring as the wider `string` clashes with the inferred type.
	declare maxTargets: number;
	declare endEarlier: boolean;
	declare effectId: string;

	static override defineSchema(): MarkTargetRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['flagKey', 'string'],
				['statusCondition', 'string'],
				['maxTargets', 'number'],
				['endEarlier', 'boolean'],
				['effectId', 'string'],
			]),
		);
	}

	/**
	 * Capacity for this flag key: the largest `maxTargets` among the actor's enabled
	 * markTarget rules with the same key whose predicate currently passes. A 0 on any
	 * contributor means unlimited (returned as 0).
	 */
	#resolveCapacity(): number {
		const rules = (this.actor as object as FlaggedActor).rules ?? [];
		let capacity = this.maxTargets;
		for (const rule of rules) {
			if (rule.type !== 'markTarget') continue;
			const other = rule as unknown as MarkTargetRule;
			if (other.flagKey !== this.flagKey) continue;
			if (!other.appliesTo()) continue;
			if (other.maxTargets === 0) return 0;
			capacity = Math.max(capacity, other.maxTargets);
		}
		return capacity;
	}

	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (!this.isOnActor) return;
		if (context.sourceItem?.uuid !== this.parentItem.uuid) return;
		if (!this.test()) return;

		// Pair each target token with its actor; tokenless targets keep a null token uuid.
		const targets: Array<{
			actor: MarkableActor;
			tokenUuid: string | null;
			token: AdditionalMarkToken | null;
		}> = [];
		for (const tokenDoc of context.targetTokens ?? []) {
			const actor = (tokenDoc as { actor?: unknown }).actor as MarkableActor | null | undefined;
			if (!actor?.uuid) continue;
			targets.push({
				actor,
				tokenUuid: (tokenDoc as { uuid?: string }).uuid ?? null,
				token: tokenDoc as AdditionalMarkToken,
			});
		}
		if (targets.length === 0) return;

		const owner = this.actor as object as FlaggedActor;
		const capacity = this.#resolveCapacity();

		const flag = { ...readToggledEffects(owner) };
		let list = Array.isArray(flag[this.flagKey]) ? [...flag[this.flagKey]] : [];
		const evicted: ToggledTargetEntry[] = [];

		for (const { actor, tokenUuid } of targets) {
			const entry: ToggledTargetEntry = {
				actorUuid: actor.uuid,
				tokenUuid,
				name: actor.name ?? '',
			};
			const next = computeNextToggledList(list, entry, capacity, this.endEarlier);
			list = next.list;
			evicted.push(...next.evicted);
		}

		flag[this.flagKey] = list;
		await owner.setFlag(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, flag);

		await this.#applyStatusEffects(targets, evicted);

		if (!this.endEarlier) return;
		const marked = targets[targets.length - 1];
		if (!marked) return;
		await offerAdditionalMark({
			actor: owner,
			flagKey: this.flagKey,
			list,
			markedActorUuid: marked.actor.uuid,
			markedToken: marked.token,
			applyMarker: async (actor) => {
				await this.#applyStatusEffects([{ actor }], []);
			},
		});
	}

	/**
	 * Applies the visible marker to freshly marked targets and clears it from evicted ones.
	 *
	 * The marker is a per-marker ActiveEffect rather than a shared status toggle: each
	 * carries the marked status plus this item's uuid (see {@link MARK_TARGET_ITEM_FLAG}),
	 * so two hunters marking the same creature get one effect each. Foundry keeps the
	 * token's marked icon lit while any effect with that status remains, and eviction
	 * deletes only the effects this item created — one hunter dropping a quarry never
	 * clears another hunter's marker.
	 *
	 * The create/delete are routed through {@link applyMarkEffect} / {@link removeMarkEffect}:
	 * `onItemActivated` runs on the activating client, which owns the marking item but usually
	 * not the target NPC, so writing ActiveEffects to the target directly would fail with a
	 * permissions error. GMs/target owners write directly; everyone else relays to the active
	 * GM. The relay also handles dedup, so re-marking never stacks a second marker.
	 */
	async #applyStatusEffects(
		targets: Array<{ actor: MarkableActor }>,
		evicted: ToggledTargetEntry[],
	): Promise<void> {
		if (!this.statusCondition) return;

		const markData = this.#buildMarkEffectData();
		const sourceItemUuid = this.parentItem.uuid;
		for (const { actor } of targets) {
			await applyMarkEffect({ target: actor, sourceItemUuid, effectData: markData });
		}

		for (const entry of evicted) {
			if (!entry.tokenUuid) continue;
			const tokenDoc = (await fromUuid(entry.tokenUuid as Parameters<typeof fromUuid>[0])) as {
				actor?: MarkableActor;
			} | null;
			const actor = tokenDoc?.actor;
			if (!actor) continue;
			await removeMarkEffect({ target: actor, sourceItemUuid });
		}
	}

	/**
	 * Creation payload for a marker ActiveEffect, named for the marking actor. With an item
	 * effect, the marker also takes that effect's img, Lasts Until, Escape, changes and rules.
	 * The name, status, origin and flag stay the marker's own: the mark code reads them.
	 */
	#buildMarkEffectData(): Record<string, unknown> {
		const conditions = CONFIG.NIMBLE.conditions as Record<string, string>;
		const images = CONFIG.NIMBLE.conditionDefaultImages as Record<string, string>;
		const conditionName = localize(conditions[this.statusCondition] ?? this.statusCondition);
		const markerName = (this.actor as object as { name?: string })?.name ?? '';
		const itemUuid = this.parentItem.uuid;

		const marker: Record<string, unknown> = {
			type: NIMBLE_EFFECT_TYPE,
			name: markerName ? `${conditionName} (${markerName})` : conditionName,
			img: images[this.statusCondition],
			statuses: [this.statusCondition],
			// Origin surfaces the source item in the effects panel; the flag is what
			// eviction matches on so it never touches another marker's effect.
			origin: itemUuid,
			flags: { [SYSTEM_ID]: { [MARK_TARGET_ITEM_FLAG]: itemUuid } },
		};

		const effect = itemEffectOf<MarkSourceEffect>(this.parentItem, this.effectId);
		if (!effect) return marker;

		const { data } = payloadFromEffect(effect, {
			itemUuid,
			user: this.actor as unknown as Parameters<typeof payloadFromEffect>[1]['user'],
		});
		const system = (data.system ?? {}) as Record<string, unknown>;
		return {
			...marker,
			img: (data.img as string | null | undefined) || marker.img,
			system: {
				changes: Array.isArray(system.changes) ? system.changes : [],
				lastsUntil: Array.isArray(system.lastsUntil) ? system.lastsUntil : [],
				...(system.escape ? { escape: system.escape } : {}),
				rules: Array.isArray(system.rules) ? system.rules : [],
			},
		};
	}
}

export { MarkTargetRule };
