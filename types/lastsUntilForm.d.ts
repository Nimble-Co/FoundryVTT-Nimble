import type { NEXT_TURN_COUNTS, TurnSpan } from '../src/models/activeEffect/nimbleEffectChoices.js';

/** The turn list's entries: each span, with "2nd next turn" and up after "next turn". */
export type SpanChoice = TurnSpan | `nextTurn:${(typeof NEXT_TURN_COUNTS)[number]}`;
