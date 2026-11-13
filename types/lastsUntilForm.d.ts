import type { TurnSpan } from '../src/models/activeEffect/nimbleEffectChoices.js';

/** The turn list's entries: each span, with "2nd next turn" and up after "next turn". */
export type SpanChoice = TurnSpan | `nextTurn:${number}`;
