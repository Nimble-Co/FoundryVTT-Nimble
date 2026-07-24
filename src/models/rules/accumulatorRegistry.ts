/**
 * Accumulator paths on `actor.system` ever pushed by any rule via
 * `pushToActorSystemArray` (e.g. `damageBonuses`, `damageReductions`).
 *
 * The actor resets these at the start of each prepare cycle: Foundry
 * sometimes calls `prepareData()` directly without re-initializing the
 * document, reusing the same system object, and without the reset every such
 * call would append duplicate entries.
 *
 * Lives in its own module so the actor documents can import it without
 * importing the rule classes (forward-declaration pattern).
 */
export const actorAccumulatorPaths = new Set<string>();
