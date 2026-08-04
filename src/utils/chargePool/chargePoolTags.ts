import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';

/**
 * Read chargePool state directly from flag storage and emit domain tags.
 * Called from actor._populateDerivedTags() (which runs before rule hooks),
 * so predicates evaluated by rule.test() can see these tags.
 *
 * Tags emitted per pool identifier <id>:
 *   - self:no<Id>Charges     when the pool is empty (camelCased)
 *   - self:<id>ChargesMax    when current === max
 *   - self:<id>ChargePool:N  where N is the current count
 *
 * Timing note, deliberate and load-bearing: these tags are a snapshot taken at
 * data preparation, so during the activation that spends the last charge they
 * still read the pre-spend count. The spend itself lands in an awaited
 * continuation (consumeOnResolvedItemUse), while rules gated on these tags are
 * filtered synchronously during the same dispatch. That is what lets a rider
 * predicated on "the pool still has a charge" fire on the very use that empties
 * the pool, which is how a once-per-encounter rider is expressed. Do not
 * "fix" this by reading live post-spend state.
 */
function populateChargePoolTags(
	flagSource: { flags?: unknown; items?: { contents: Array<{ flags?: unknown }> } },
	tags: Set<string>,
): void {
	emitFromFlagBag(flagSource.flags, tags);

	const items = flagSource.items?.contents;
	if (!items) return;

	for (const item of items) {
		emitFromFlagBag(item.flags, tags);
	}
}

function emitFromFlagBag(flags: unknown, tags: Set<string>): void {
	if (!flags || typeof flags !== 'object') return;
	const systemFlags = (flags as Record<string, unknown>)[ChargePoolRuleConfig.flagScope];
	if (!systemFlags || typeof systemFlags !== 'object' || Array.isArray(systemFlags)) return;

	const chargePools = (systemFlags as Record<string, unknown>)[ChargePoolRuleConfig.flagKey];
	if (!chargePools || typeof chargePools !== 'object' || Array.isArray(chargePools)) return;

	for (const [poolId, value] of Object.entries(chargePools as Record<string, unknown>)) {
		if (!value || typeof value !== 'object') continue;
		const pool = value as { identifier?: unknown; current?: unknown; max?: unknown };

		// Actor-scoped pools are stored under an `actor:<identifier>` key; item-scoped
		// pools are stored under the bare identifier. Both carry the bare identifier in
		// the state itself, so the prefix strip only matters for the key fallback.
		const rawIdentifier = typeof pool.identifier === 'string' ? pool.identifier : poolId;
		const identifier = rawIdentifier.replace(/^actor:/, '').trim();
		if (identifier.length < 1) continue;

		const rawCurrent = typeof pool.current === 'number' ? pool.current : Number(pool.current);
		if (!Number.isFinite(rawCurrent)) continue;
		const current = Math.max(0, Math.floor(rawCurrent));
		const max = typeof pool.max === 'number' ? pool.max : Number(pool.max);

		tags.add(`self:${identifier}ChargePool:${current}`);

		if (current === 0) {
			tags.add(`self:no${capitalize(identifier)}Charges`);
		}

		if (Number.isFinite(max) && current >= max && max > 0) {
			tags.add(`self:${identifier}ChargesMax`);
		}
	}
}

function capitalize(value: string): string {
	if (value.length < 1) return value;
	return value[0].toUpperCase() + value.slice(1);
}

export { populateChargePoolTags };
