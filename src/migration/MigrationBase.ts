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

	updateActor?(source: any, context?: MigrationContext): Promise<void>;

	updateItem?(source: any, parent?: any, context?: MigrationContext): Promise<void>;

	updateEffect?(source: any, parent?: any, context?: MigrationContext): Promise<void>;

	updateMessage?(source: any, context?: MigrationContext): Promise<void>;

	/** The structure part of a content migration: it runs on a copy the GM keeps out, too. */
	alwaysUpdateItem?(source: any, parent?: any, context?: MigrationContext): Promise<void>;

	/** The structure part of a content migration, for an effect on an actor or an item. */
	alwaysUpdateEffect?(source: any, parent?: any, context?: MigrationContext): Promise<void>;

	protected getSourceId(source: any): string | undefined {
		return source._stats?.compendiumSource ?? source.flags?.core?.sourceId;
	}
}

export { MigrationBase };
export type { MigrationContext, MigrationKind };
