import type { RollTable } from '#types/chaos.d.ts';

/** The Chaos Table, the default table of the table roll rules. */
export const CHAOS_TABLE: RollTable = 'chaos';

/** The tables a table roll rule can name. */
export const ROLL_TABLES: readonly RollTable[] = [CHAOS_TABLE];

/** The name of each table in the tables compendium. */
export const TABLE_NAMES: Record<RollTable, string> = { [CHAOS_TABLE]: 'Chaos Table' };
