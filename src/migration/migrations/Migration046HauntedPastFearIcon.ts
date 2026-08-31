import { MigrationBase } from '../MigrationBase.js';

const FEAR_ADVANTAGE_RULE_ID = 'N43aM4mMNGpq5WN6';

const FEAR_ICON = 'fa-solid fa-ghost';

interface RuleSource {
	type?: string;
	id?: string;
	icon?: string;
}

/**
 * Stamps the ghost icon onto the Haunted Past fear rule that Migration045 wrote
 * before `situationalRollMode` had an `icon` field. Without it those copies fall
 * back to the generic advantage icon, so the option reads as a plain plus rather
 * than naming the situation.
 *
 * Matched by the pack's rule id alone: a homebrew rule carries a random id, and a
 * GM who picked their own icon should keep it.
 */
class Migration046HauntedPastFearIcon extends MigrationBase {
	static override readonly version = 46;

	override readonly version = Migration046HauntedPastFearIcon.version;

	#addIcon(system: any): void {
		const rules: RuleSource[] = Array.isArray(system?.rules) ? system.rules : [];

		for (const rule of rules) {
			if (rule?.type !== 'situationalRollMode') continue;
			if (rule.id !== FEAR_ADVANTAGE_RULE_ID) continue;
			if (rule.icon) continue;

			rule.icon = FEAR_ICON;
		}
	}

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'background') return;

		this.#addIcon(source.system);
	}

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];
		for (const item of items) {
			if (item?.type !== 'background') continue;

			this.#addIcon(item.system);
		}
	}
}

export { Migration046HauntedPastFearIcon };
