abstract class MigrationBase {
	static readonly version: number;

	readonly version: number = (this.constructor as typeof MigrationBase).version;

	requiresFlush = false;

	updateActor?(source: Record<string, unknown>): Promise<void>;

	updateItem?(source: Record<string, unknown>, parent?: Record<string, unknown>): Promise<void>;

	updateEffect?(source: Record<string, unknown>, parent?: Record<string, unknown>): Promise<void>;

	updateJournalEntry?(source: Record<string, unknown>): Promise<void>;

	updateMacro?(source: Record<string, unknown>): Promise<void>;

	updateTable?(source: Record<string, unknown>): Promise<void>;

	updateToken?(source: Record<string, unknown>, actor: Actor, scene: Scene): Promise<void>;

	updateScene?(source: Record<string, unknown>): Promise<void>;

	updateUser?(source: Record<string, unknown>): Promise<void>;

	migrate?(): Promise<void>;
}

export { MigrationBase };
