import { MigrationBase } from '../MigrationBase.js';

/**
 * Up to 0.10.0 a character's Inspiration started on and nothing read it. The new sheet shows it,
 * so a character made before then would show Inspiration it was never given.
 */
class Migration090InspirationStartsOff extends MigrationBase {
	static override readonly version = 90;

	override readonly version = Migration090InspirationStartsOff.version;

	override async updateActor(source: any): Promise<void> {
		if (source?.type !== 'character') return;
		const resources = source.system?.resources;
		if (resources?.inspiration !== true) return;

		resources.inspiration = false;
		console.log(`Nimble Migration | ${source.name}: Inspiration starts off`);
	}
}

export { Migration090InspirationStartsOff };
