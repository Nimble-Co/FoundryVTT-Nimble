import { SYSTEM_ID } from '#system';
import {
	computeNextToggledList,
	readToggledEffects,
	TOGGLED_EFFECTS_FLAG_KEY,
	type ToggledTargetEntry,
} from '#utils/toggledEffects.js';
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
	};
}

declare namespace MarkTargetRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface StatusEffectActor {
	toggleStatusEffect(
		statusId: string,
		options?: { active?: boolean; overlay?: boolean },
	): Promise<unknown>;
}

interface FlaggedActor {
	uuid: string;
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
	rules?: NimbleBaseRule[];
}

/**
 * Records one or more target creatures on the owning actor as a tracked mark (e.g. a
 * Hunter's quarry). Marks are stored relationally on the *marking* actor under
 * `flags.<system>.toggledEffects.<flagKey>`, so the matching `target:<flagKey>` predicate
 * tag resolves only for that actor when it attacks.
 *
 * An optional `statusCondition` is applied to each marked target as a visible token
 * marker. Capacity is the largest `maxTargets` among the actor's enabled markTarget rules
 * sharing this `flagKey` (a value of 0 means unlimited) — this lets a separate upgrade
 * feature raise the cap (e.g. the Hunter's level-20 Nemesis) without the primary rule
 * knowing about it. Marking beyond capacity evicts the oldest mark. There is no time-based
 * expiry: "until you mark another creature" is exactly the capacity-eviction behaviour.
 */
class MarkTargetRule extends NimbleBaseRule<MarkTargetRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.markTarget.description';

	declare flagKey: string;
	// `statusCondition` is inferred from the schema's `choices` (condition keys plus the
	// blank sentinel). Re-declaring as the wider `string` clashes with the inferred type.
	declare maxTargets: number;

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
		if (!this.item.isEmbedded) return;
		if (context.sourceItem?.uuid !== this.item.uuid) return;
		if (!this.test()) return;

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
			const next = computeNextToggledList(list, entry, capacity);
			list = next.list;
			evicted.push(...next.evicted);
		}

		flag[this.flagKey] = list;
		await owner.setFlag(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, flag);

		await this.#applyStatusEffects(targets, evicted);
	}

	/** Applies the visible status to freshly marked targets and clears it from evicted ones. */
	async #applyStatusEffects(
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
}

export { MarkTargetRule };
