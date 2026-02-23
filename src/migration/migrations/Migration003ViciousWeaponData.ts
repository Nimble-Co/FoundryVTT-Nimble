import type {
	ActionConsequence,
	DamageNode,
	DamageOutcomeNode,
	TextNode,
} from '#types/effectTree.js';
import { MigrationBase } from '../MigrationBase.js';

/**
 * Source structure for item activation effects during migration.
 * This represents the raw data shape before it's fully validated.
 */
interface ItemActivationSource {
	effects?: DamageNode[];
}

/**
 * Source structure for item system data during migration.
 */
interface ItemSystemSource {
	activation?: ItemActivationSource;
	properties?: {
		selected?: string[];
	};
}

/**
 * Source structure for items during migration.
 */
interface ItemSource {
	name: string;
	type: string;
	system?: ItemSystemSource;
}

/**
 * Migration to fix vicious weapon/spell data.
 *
 * Updates items with the vicious property to ensure:
 * 1. They have a vicious damage die on criticalHit
 * 2. The vicious damage die does NOT have canCrit (only primary die crits)
 * 3. The vicious damage has ignoreArmor: true
 *
 * Also updates Dravok's Terrible Maw to use 4 separate damage effects.
 */
class Migration003ViciousWeaponData extends MigrationBase {
	static override readonly version = 4;

	override readonly version = Migration003ViciousWeaponData.version;

	override async updateItem(source: ItemSource): Promise<void> {
		// Handle vicious weapons/spells
		if (this.#hasViciousProperty(source)) {
			this.#updateViciousItem(source);
		}

		// Handle Dravok's Terrible Maw specifically
		if (source.name === 'Terrible Maw' && source.type === 'monsterFeature') {
			this.#updateTerribleMaw(source);
		}
	}

	#hasViciousProperty(source: ItemSource): boolean {
		const selectedProperties = source.system?.properties?.selected;
		if (!Array.isArray(selectedProperties)) return false;
		return selectedProperties.includes('vicious');
	}

	#updateViciousItem(source: ItemSource): void {
		const effects = source.system?.activation?.effects;
		if (!Array.isArray(effects)) return;

		for (const effect of effects) {
			if (effect.type !== 'damage' || !effect.canCrit) continue;

			// Ensure on property and criticalHit array exist
			if (!effect.on) effect.on = {};
			if (!effect.on.criticalHit) effect.on.criticalHit = [];

			// Check if vicious damage already exists
			const hasCritDamage = effect.on.criticalHit.some(
				(e): e is DamageNode => e.type === 'damage' && e.parentContext === 'criticalHit',
			);

			if (!hasCritDamage) {
				this.#addViciousDamage(source, effect);
			} else {
				this.#fixExistingViciousDamage(source, effect.on.criticalHit);
			}
		}
	}

	#addViciousDamage(source: ItemSource, effect: DamageNode): void {
		const criticalHit = effect.on?.criticalHit;
		if (!criticalHit) return;

		// Add CRIT note if not present
		const hasCritNote = criticalHit.some(
			(e): e is TextNode => e.type === 'note' && e.parentContext === 'criticalHit',
		);

		if (!hasCritNote) {
			const critNote: TextNode = {
				id: foundry.utils.randomID(),
				type: 'note',
				noteType: 'warning',
				text: 'CRIT',
				parentContext: 'criticalHit',
				parentNode: effect.id,
			};
			criticalHit.unshift(critNote);
		}

		// Add vicious damage die
		const viciousDamage: DamageNode = {
			id: foundry.utils.randomID(),
			type: 'damage',
			damageType: effect.damageType,
			formula: this.#extractBaseDie(effect.formula),
			parentContext: 'criticalHit',
			parentNode: effect.id,
			ignoreArmor: true,
			on: {},
		};
		criticalHit.push(viciousDamage);

		console.log(`Nimble Migration | ${source.name}: added vicious crit damage`);
	}

	#fixExistingViciousDamage(
		source: ItemSource,
		criticalHit: ActionConsequence['criticalHit'],
	): void {
		if (!criticalHit) return;

		for (const critEffect of criticalHit) {
			if (critEffect.type === 'damage' && critEffect.parentContext === 'criticalHit') {
				const damageEffect = critEffect as DamageNode;

				if (damageEffect.canCrit) {
					delete damageEffect.canCrit;
					console.log(`Nimble Migration | ${source.name}: removed canCrit from vicious damage`);
				}

				// Remove nested criticalHit if present (vicious dice shouldn't chain-crit)
				if (damageEffect.on?.criticalHit) {
					damageEffect.on = {};
					console.log(
						`Nimble Migration | ${source.name}: removed nested criticalHit from vicious damage`,
					);
				}

				// Ensure ignoreArmor is set
				if (!damageEffect.ignoreArmor) {
					damageEffect.ignoreArmor = true;
				}
			}
		}
	}

	#updateTerribleMaw(source: ItemSource): void {
		const effects = source.system?.activation?.effects;
		if (!Array.isArray(effects) || effects.length === 0) return;

		const firstEffect = effects[0];

		// Check if already migrated (has 4 separate 1d4 effects)
		if (effects.length >= 4 && effects.every((e) => e.formula === '1d4')) {
			// Already migrated, just fix any canCrit issues on vicious dice
			for (const effect of effects) {
				if (effect.on?.criticalHit) {
					this.#fixExistingViciousDamage(source, effect.on.criticalHit);
				}
			}
			return;
		}

		// Check if using old combined formula
		if (!firstEffect.formula?.includes('4d4') && !firstEffect.formula?.includes('1d4x')) {
			return;
		}

		console.log(`Nimble Migration | Terrible Maw: converting to 4 separate damage effects`);

		// Create 4 separate damage effects
		const newEffects: DamageNode[] = [];
		for (let i = 1; i <= 4; i++) {
			const effectId = foundry.utils.randomID();

			const damageOutcome: DamageOutcomeNode = {
				id: foundry.utils.randomID(),
				type: 'damageOutcome',
				outcome: 'fullDamage',
				parentContext: 'hit',
				parentNode: effectId,
			};

			const critNote: TextNode = {
				id: foundry.utils.randomID(),
				type: 'note',
				noteType: 'warning',
				text: 'CRIT',
				parentContext: 'criticalHit',
				parentNode: effectId,
			};

			const viciousDamage: DamageNode = {
				id: foundry.utils.randomID(),
				type: 'damage',
				damageType: 'piercing',
				formula: '1d4',
				parentContext: 'criticalHit',
				parentNode: effectId,
				ignoreArmor: true,
				on: {},
			};

			const damageNode: DamageNode = {
				id: effectId,
				type: 'damage',
				damageType: 'piercing',
				formula: '1d4',
				parentContext: null,
				parentNode: null,
				canCrit: true,
				canMiss: true,
				on: {
					hit: [damageOutcome],
					criticalHit: [critNote, viciousDamage],
				},
			};

			newEffects.push(damageNode);
		}

		// Replace effects array
		source.system!.activation!.effects = newEffects;
	}

	/**
	 * Extract the base die from a formula (e.g., "1d4+@dexterity" -> "1d4")
	 */
	#extractBaseDie(formula: string): string {
		const match = formula.match(/\d+d\d+/);
		return match ? match[0] : '1d4';
	}
}

export { Migration003ViciousWeaponData };
