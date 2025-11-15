type ActivationCost = {
	details: string;
	quantity: number;
	type: string;
	isReaction: boolean;
};

type ActivationTemplate = {
	length: number;
	radius: number;
	shape: string;
	width: number;
};

type ActivationData = {
	acquireTargetsFromTemplate: boolean;
	cost: ActivationCost;
	duration: {
		details: string;
		quantity: number;
		type: string;
	};
	effects: unknown[];
	showDescription: boolean;
	targets: {
		count: number;
		restrictions: string;
	};
	template: ActivationTemplate;
};

type RangeData = {
	min: number;
	max: number | null;
};

declare module '../src/models/item/FeatureDataModel' {
	interface NimbleFeatureData {
		activation: ActivationData;
		class: string;
		description: string;
		featureType: string;
		group: string;
	}
}

declare module '../src/models/item/MonsterFeatureDataModel' {
	interface NimbleMonsterFeatureData {
		activation: ActivationData;
		description: string;
		subtype: string;
	}
}

declare module '../src/models/item/ObjectDataModel' {
	interface NimbleObjectData {
		activation: ActivationData;
		description: {
			public: string;
			secret: string;
			unidentified: string;
		};
		identified: boolean;
		objectSizeType: string;
		objectType: string;
		properties: {
			range: RangeData;
			reach: RangeData;
			selected: string[];
			strengthRequirement: {
				value: number | null;
				overridesTwoHanded: boolean;
			};
			thrownRange: number;
		};
		quantity: number;
		slotsRequired: number;
		stackSize: number;
		unidentifiedName: string;
	}
}

declare module '../src/models/item/SpellDataModel' {
	interface NimbleSpellData {
		activation: ActivationData;
		description: {
			baseEffect: string;
			higherLevelEffect: string;
		};
		properties: {
			range: RangeData;
			reach: RangeData;
			selected: string[];
		};
		school: string;
		tier: number;
	}
}

declare module '../src/models/item/AncestryDataModel' {
	interface NimbleAncestryData {
		description: string;
		exotic: boolean;
		size: string[];
	}
}

declare module '../src/models/item/BackgroundDataModel' {
	interface NimbleBackgroundData {
		description: string;
	}
}

declare module '../src/models/item/BoonDataModel' {
	interface NimbleBoonData {
		boonType: string;
		description: string;
	}
}

declare module '../src/models/item/ClassDataModel' {
	interface NimbleClassData {
		abilityScoreData: Record<
			string,
			{
				value: string;
				type: string;
				statIncreaseType: string;
			}
		>;
		armorProficiencies: string[];
		classLevel: number;
		description: string;
		groupIdentifiers: string[];
		hitDieSize: number;
		hpData: number[];
		keyAbilityScores: string[];
		mana: {
			formula: string;
			recovery: string;
		};
		resources: Array<Record<string, unknown>>;
		savingThrows: {
			advantage: string;
			disadvantage: string;
		};
		weaponProficiencies: string[];
	}
}

declare module '../src/models/item/SubclassDataModel' {
	interface NimbleSubclassData {
		description: string;
		parentClass: string;
		resources: Array<Record<string, unknown>>;
	}
}

declare module '../src/models/actor/CharacterDataModel' {
	interface NimbleCharacterData {
		abilities: Record<
			string,
			{
				baseValue: number;
				bonus: number;
				mod: number;
			}
		>;
		attributes: {
			armor: {
				baseValue: string;
				components: Array<{
					mode: string;
					priority: number;
					source: string;
					value: number;
				}>;
				hint: string;
				value: number;
			};
			hitDice: Record<
				string,
				{
					current: number;
					bonus?: number;
					origin: string[];
				}
			>;
			hp: {
				bonus: number;
				max: number;
				temp: number;
				value: number;
			};
			initiative: {
				bonuses: string;
				mod?: number;
			};
			movement: Record<string, number>;
			sizeCategory: string;
			wounds: {
				bonus: number;
				max?: number;
				value: number;
			};
		};
		classData: {
			startingClass?: string;
			levels: string[];
		};
		currency: Record<
			string,
			{
				value: number;
			}
		>;
		inventory: {
			bonusSlots: number;
			totalSlots: number;
			usedSlots: number;
		};
		levelUpHistory: Array<{
			level: number;
			hpIncrease: number;
			abilityIncreases: Record<string, number>;
			skillIncreases: Record<string, number>;
			hitDieAdded?: boolean;
			classIdentifier: string;
		}>;
		proficiencies: {
			armor: string[];
			languages: string[];
			weapons: string[];
		};
		resources: {
			inventory: {
				bonusSlots: number;
				totalSlots: number;
				usedSlots: number;
			};
			mana: {
				baseMax: number;
				current: number;
				max: number;
				value: number;
			};
			[key: string]: unknown;
		};
		savingThrows: Record<string, { mod: number }>;
		skills: Record<
			string,
			{
				bonus: number;
				defaultRollMode: number;
				mod: number;
				points: number;
			}
		>;
	}
}

declare module '../src/models/actor/SoloMonsterDataModel' {
	interface NimbleSoloMonsterData {
		attributes: {
			armor: string;
			damageImmunities: string[];
			damageResistances: string[];
			damageVulnerabilities: string[];
			hp: {
				max: number;
				temp: number;
				value: number;
			};
			movement: Record<string, number>;
			sizeCategory: string;
		};
		bloodiedEffect: {
			description: string;
		};
		description: string;
		details: {
			creatureType: string;
			level: string;
		};
		lastStandEffect: {
			description: string;
		};
	}
}

export {};
