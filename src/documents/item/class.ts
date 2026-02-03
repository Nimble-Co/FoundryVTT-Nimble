import {
	ClassResourceManager,
	type ClassResourceItem,
} from '../../managers/ClassResourceManager.js';
import type { NimbleClassData } from '../../models/item/ClassDataModel.js';
import type { NimbleCharacter } from '../actor/character.js';
import { NimbleBaseItem } from './base.svelte.js';

export class NimbleClassItem extends NimbleBaseItem {
	declare ASI: Record<string, number>;

	declare hitDice: { size: number; total: number };

	declare maxHp: number;

	declare resources: ClassResourceManager;

	declare system: NimbleClassData;

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get grantedArmorProficiencies(): string[] {
		return this.system.armorProficiencies;
	}

	get grantedWeaponProficiencies(): string[] {
		return this.system.weaponProficiencies;
	}

	/** ------------------------------------------------------ */
	/**                 Data Prep Functions                    */
	/** ------------------------------------------------------ */
	override prepareBaseData(): void {
		super.prepareBaseData();

		this.resources = new ClassResourceManager(this as unknown as ClassResourceItem);

		this.ASI = Object.entries(this.system.abilityScoreData ?? {}).reduce(
			(acc, [level, data]) => {
				if (data.type !== 'statIncrease') return acc;
				if (Number.parseInt(level, 10) > this.system.classLevel) return acc;
				if (data.value.length === 0) return acc;

				// Handle both single ability scores and arrays (for capstone)
				const values = Array.isArray(data.value) ? data.value : [data.value];

				for (const abilityKey of values) {
					acc[abilityKey] ??= 0;
					acc[abilityKey] += 1;
				}

				return acc;
			},
			{} as Record<string, number>,
		);

		this.maxHp =
			CONFIG.NIMBLE.startingHpByHitDieSize[this.system.hitDieSize] +
			this.system.hpData.reduce((acc, value) => acc + value, 0);

		this.hitDice = {
			size: this.system.hitDieSize,
			total: this.system.classLevel,
		};
	}

	override _populateBaseTags(): void {
		super._populateBaseTags();

		this.tags.add(`class:${this.identifier}`);
		this.tags.add(`level:class:${this.system.classLevel}`);
	}

	override prepareDerivedData(): void {
		super.prepareDerivedData();
	}

	override _populateDerivedTags(): void {
		super._populateDerivedTags();
	}

	override async prepareChatCardData() {
		const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description,
		);

		return {
			author: game.user?.id,
			flavor: `${this.actor?.name}: ${this.name}`,
			type: 'feature',
			system: {
				description: description || 'No description available.',
				featureType: this.type,
				name: this.name,
			},
		};
	}

	/** ------------------------------------------------------ */
	//                 Document Update Hooks
	/** ------------------------------------------------------ */
	override async _preCreate(data, options, user) {
		// Set Defaults
		foundry.utils.setProperty(data, 'system.classLevel', 1);
		foundry.utils.setProperty(data, 'system.hpData', []);

		// Special workflow if this class is being created on an actor.
		if (this.isEmbedded) {
			const actor = this.parent as NimbleCharacter;
			const actorUpdates = {};
			let proceedWithCreate = true;

			if (Object.keys(actor.classes).length) return false;

			// Set up as starting class
			if (!actor.system.classData.startingClass) {
				actorUpdates['system.classData.startingClass'] = this.identifier;
			}

			const startingHp = CONFIG.NIMBLE.startingHpByHitDieSize[this.system.hitDieSize];
			actorUpdates['system.attributes.hp.value'] = startingHp ?? 0;

			// Add HitDice Data to actor
			const existingHitDice = foundry.utils.getProperty(
				actor,
				`system.attributes.hitDice.${this.system.hitDieSize}`,
			) as { current: number; origin: string[] } | undefined;
			if (!existingHitDice) {
				actorUpdates[`system.attributes.hitDice.${this.system.hitDieSize}`] = {
					current: 1,
					origin: [this.identifier],
				};
			} else {
				actorUpdates[`system.attributes.hitDice.${this.system.hitDieSize}.origin`] = [
					...existingHitDice.origin,
					this.identifier,
				];
			}

			// Tell the actor what level this class was gained at
			const existingLevels =
				(foundry.utils.getProperty(actor, 'system.classData.levels') as string[] | undefined) ?? [];
			existingLevels.push(this.identifier);

			actorUpdates['system.classData.levels'] = existingLevels;

			// Update existing level if available
			const existingClass = actor.classes[this.identifier];

			if (existingClass) {
				// await existingClass.update({ 'system.classLevel': existingClass.system.classLevel + 1 });
				proceedWithCreate = false;
			}

			this.updateSource(data);

			if (proceedWithCreate) {
				await super._preCreate(data, options, user);
			}

			await actor.update(actorUpdates);

			return proceedWithCreate;
		}

		this.updateSource(data);
		await super._preCreate(data, options, user);
		return true;
	}

	override async _preUpdate(
		changed: Record<string, unknown>,
		options: Item.Database.UpdateOptions,
		user: User.Implementation,
	): Promise<boolean | undefined> {
		const result = await super._preUpdate(changed, options, user);

		if (!this.isEmbedded) return result;

		const actor = this.parent as NimbleCharacter;
		const actorUpdates = {};

		// Type the changed object for this method's usage
		const changedData = changed as {
			name?: string & { slugify: (options: { strict: boolean }) => string };
			system?: { hitDieSize?: number };
		};

		if (changedData.name) {
			const existingLevels =
				(foundry.utils.getProperty(actor, 'system.classData.levels') as string[] | undefined) ?? [];
			const newIdentifier = changedData.name.slugify({ strict: true });

			actorUpdates['system.classData.levels'] = existingLevels.reduce(
				(ids: string[], id: string) => {
					if (id === this.identifier) ids.push(newIdentifier);
					else ids.push(id);

					return ids;
				},
				[],
			);

			if (actor.system.classData.startingClass === this.identifier) {
				actorUpdates['system.classData.startingClass'] = newIdentifier;
			}

			if (!changedData.system?.hitDieSize) {
				const existingHitDice =
					(foundry.utils.getProperty(
						actor,
						`system.attributes.hitDice.${this.system.hitDieSize}.origin`,
					) as string[] | undefined) ?? [];

				actorUpdates[`system.attributes.hitDice.${this.system.hitDieSize}.origin`] =
					existingHitDice.reduce((ids: string[], id: string) => {
						if (id === this.identifier) ids.push(newIdentifier);
						else ids.push(id);

						return ids;
					}, [] as string[]);
			}
		}

		if (changedData.system?.hitDieSize) {
			const existingHitDice =
				(foundry.utils.getProperty(
					actor,
					`system.attributes.hitDice.${this.system.hitDieSize}.origin`,
				) as string[] | undefined) ?? [];

			const existingHitDiceCount = existingHitDice.length ?? 0;

			const existingHitDiceSansCurrentClass = existingHitDice.filter(
				(id: string) => this.identifier !== id,
			);

			const postFilterHitDiceCount = existingHitDiceSansCurrentClass.length;
			const hitDiceCountDifference = existingHitDiceCount - postFilterHitDiceCount;

			if (hitDiceCountDifference > 0) {
				const existingNewHitDice =
					(foundry.utils.getProperty(
						actor,
						`system.attributes.hitDice.${changedData.system.hitDieSize}.origin`,
					) as string[] | undefined) ?? [];

				actorUpdates[`system.attributes.hitDice.${changedData.system.hitDieSize}.origin`] =
					existingNewHitDice.concat(
						Array(hitDiceCountDifference).fill(
							changedData.name?.slugify({ strict: true }) ?? this.identifier,
						),
					);

				actorUpdates[`system.attributes.hitDice.${this.system.hitDieSize}.origin`] =
					existingHitDiceSansCurrentClass;
			}
		}

		actor.update(actorUpdates);

		return result;
	}

	override _onCreate(data, options, userId) {
		super._onCreate(data, options, userId);
	}

	override _onUpdate(changed, options, userId) {
		super._onUpdate(changed, options, userId);
	}

	override _onDelete(options, userId: string) {
		super._onDelete(options, userId);

		// Update actor data
		if (this.isEmbedded) {
			const actor = this.parent as NimbleCharacter;
			const actorUpdates = {};

			if (actor.system.classData.startingClass === this.identifier) {
				actorUpdates['system.classData.startingClass'] = null;
			}

			// Remove hitDice information
			const existingHitDice = foundry.utils.getProperty(
				actor,
				`system.attributes.hitDice.${this.system.hitDieSize}`,
			) as { current: number; origin: string[] } | undefined;

			if (existingHitDice?.origin?.length && existingHitDice.origin.length > 1) {
				actorUpdates[`system.attributes.hitDice.${this.system.hitDieSize}.origin`] =
					existingHitDice.origin.filter((id: string) => this.identifier !== id);
			} else {
				actorUpdates[`system.attributes.hitDice.-=${this.system.hitDieSize}`] = null;
			}

			// Remove Levels information
			const existingLevels =
				(foundry.utils.getProperty(actor, 'system.classData.levels') as string[] | undefined) ?? [];
			actorUpdates['system.classData.levels'] = existingLevels.filter(
				(id: string) => id !== this.identifier,
			);

			actor.update(actorUpdates);
		}
	}
}
