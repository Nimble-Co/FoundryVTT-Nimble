import { DicePoolRuleConfig } from './dicePoolRuleConfig.js';

/**
 * Read dicePool state directly from flag storage and emit domain tags.
 * Called from actor._populateDerivedTags() (which runs before rule hooks),
 * so predicates evaluated by rule.test() can see these tags.
 *
 * Tags emitted per pool identifier <id>:
 *   - self:no<Id>Dice     when the pool has zero faces (camelCased)
 *   - self:<id>DiceMax    when faces.length === max
 *   - self:<id>DicePool:N where N is the current count
 */
function populateDicePoolTags(
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
	const nimbleFlags = (flags as Record<string, unknown>)[DicePoolRuleConfig.flagScope];
	if (!nimbleFlags || typeof nimbleFlags !== 'object' || Array.isArray(nimbleFlags)) return;

	const dicePools = (nimbleFlags as Record<string, unknown>)[DicePoolRuleConfig.flagKey];
	if (!dicePools || typeof dicePools !== 'object' || Array.isArray(dicePools)) return;

	for (const [poolId, value] of Object.entries(dicePools as Record<string, unknown>)) {
		if (!value || typeof value !== 'object') continue;
		const pool = value as { identifier?: unknown; faces?: unknown; max?: unknown };

		const rawIdentifier = typeof pool.identifier === 'string' ? pool.identifier : poolId;
		const identifier = rawIdentifier.replace(/^actor:/, '').trim();
		if (identifier.length < 1) continue;

		const faces = Array.isArray(pool.faces) ? pool.faces : [];
		const count = faces.length;
		const max = typeof pool.max === 'number' ? pool.max : Number(pool.max);

		tags.add(`self:${identifier}DicePool:${count}`);

		if (count === 0) {
			tags.add(`self:no${capitalize(identifier)}Dice`);
		}

		if (Number.isFinite(max) && count >= max && max > 0) {
			tags.add(`self:${identifier}DiceMax`);
		}
	}
}

function capitalize(value: string): string {
	if (value.length < 1) return value;
	return value[0].toUpperCase() + value.slice(1);
}

export { populateDicePoolTags };
