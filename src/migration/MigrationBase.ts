/**
 * `structure` changes the shape of the data and always runs. `content` changes only what a
 * document says or does, so the GM can keep a Compendium Copy out of it.
 */
type MigrationKind = 'structure' | 'content';

/** The document a hook runs inside: the actor, item or message the runner migrates as a whole. */
interface MigrationContext {
	uuid: string | null;
}

abstract class MigrationBase {
	static readonly version: number;

	readonly version: number = MigrationBase.version;

	/** Shown to the GM in the World Migration window. Not translated. */
	abstract readonly title: string;

	abstract readonly kind: MigrationKind;

	requiresFlush = false;

	updateActor?(source: any): Promise<void>;

	updateItem?(source: any, parent?: any): Promise<void>;

	updateEffect?(source: any, parent?: any): Promise<void>;

	updateJournalEntry?(source: any): Promise<void>;

	updateMacro?(source: any): Promise<void>;

	updateTable?(source: any): Promise<void>;

	updateToken?(source: any, actor: any, scene: any): Promise<void>;

	updateScene?(source: any): Promise<void>;

	updateUser?(source: any): Promise<void>;

	migrate?(): Promise<void>;

	protected getSourceId(source: any): string | undefined {
		return source._stats?.compendiumSource ?? source.flags?.core?.sourceId;
	}
}

export { MigrationBase };
export type { MigrationContext, MigrationKind };
