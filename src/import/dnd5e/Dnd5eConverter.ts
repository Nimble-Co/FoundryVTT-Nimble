/**
 * Convert a normalized Dnd5eStatblock into Nimble Actor.CreateData + ConversionReport.
 */

import {
	classifyArmor,
	crToLevel,
	DEFAULT_ACTOR_IMAGE,
	DEFAULT_FEATURE_ICONS,
	DND5E_ACTION_TYPE_MAP,
	DND5E_SAVE_TO_NIMBLE,
	FEATURE_SUBTYPES,
	feetToSquares,
	mapCondition,
	SHARED_DAMAGE_TYPES,
	SIZE_TO_TOKEN_DIMENSIONS,
} from './constants.js';
import type {
	ActorType,
	BatchImportResult,
	ConversionField,
	ConversionItemReport,
	ConversionReport,
	Dnd5eStatblock,
	Dnd5eStatblockAction,
	ImportOptions,
	ImportResult,
	ReviewFlag,
	SkippedItemReport,
	SpellMatchResult,
} from './types.js';

// ─── Utility ─────────────────────────────────────────────────────────────────

function generateId(): string {
	return foundry.utils.randomID(16);
}

function field<T>(value: T, flag: ReviewFlag, note?: string, source?: string): ConversionField<T> {
	return { value, flag, ...(note && { note }), ...(source && { source }) };
}

// ─── Field Converters ────────────────────────────────────────────────────────

export function convertName(sb: Dnd5eStatblock): ConversionField<string> {
	return field(sb.name, 'auto');
}

export function convertSize(sb: Dnd5eStatblock): ConversionField<string> {
	return field(sb.size, 'auto', undefined, `5e size: ${sb.size}`);
}

export function convertCreatureType(sb: Dnd5eStatblock): ConversionField<string> {
	return field(sb.creatureType, 'auto');
}

export function convertHP(sb: Dnd5eStatblock): ConversionField<number> {
	return field(
		sb.hp,
		'auto',
		sb.hitDice ? `Hit Dice: ${sb.hitDice}` : undefined,
		`5e HP: ${sb.hp}`,
	);
}

export function convertArmor(sb: Dnd5eStatblock): ConversionField<string> {
	const { value, note } = classifyArmor(sb.ac);
	return field(value, 'review', note, `5e AC: ${sb.ac}${sb.acSource ? ` (${sb.acSource})` : ''}`);
}

export function convertLevel(sb: Dnd5eStatblock): ConversionField<string> {
	const { level, note } = crToLevel(sb.cr);
	return field(level, 'review', note, `5e CR: ${sb.cr}`);
}

export function convertMovement(sb: Dnd5eStatblock): ConversionField<Record<string, number>> {
	const nimbleMovement: Record<string, number> = {};
	const notes: string[] = [];

	for (const [mode, feet] of Object.entries(sb.movement)) {
		const squares = feetToSquares(feet);
		nimbleMovement[mode] = squares;
		notes.push(`${mode}: ${feet}ft → ${squares} spaces`);
	}

	return field(nimbleMovement, 'auto', notes.join(', '));
}

export function convertDamageTraits(traits: string[], label: string): ConversionField<string[]> {
	const mapped: string[] = [];
	const warnings: string[] = [];

	for (const trait of traits) {
		const lower = trait.toLowerCase().trim();
		// Strip "nonmagical" qualifiers for the mapping
		const base = lower.replace(/\s*\(.*\)/, '').trim();
		if (SHARED_DAMAGE_TYPES.has(base)) {
			mapped.push(base);
		} else {
			warnings.push(`Unknown ${label}: "${trait}"`);
		}
	}

	const flag: ReviewFlag = warnings.length > 0 ? 'review' : 'auto';
	return field(mapped, flag, warnings.length > 0 ? warnings.join('; ') : undefined);
}

export function convertSavingThrows(
	sb: Dnd5eStatblock,
): ConversionField<Record<string, { defaultRollMode: number; mod: number }>> {
	const nimbleSaves: Record<string, { defaultRollMode: number; mod: number }> = {
		strength: { defaultRollMode: 0, mod: 0 },
		dexterity: { defaultRollMode: 0, mod: 0 },
		intelligence: { defaultRollMode: 0, mod: 0 },
		will: { defaultRollMode: 0, mod: 0 },
	};

	const notes: string[] = [];

	for (const prof of sb.saveProficiencies) {
		const nimbleSave = DND5E_SAVE_TO_NIMBLE[prof.toLowerCase()];
		if (nimbleSave) {
			// Only upgrade — don't downgrade if already set to advantage
			if (nimbleSaves[nimbleSave].defaultRollMode < 1) {
				nimbleSaves[nimbleSave].defaultRollMode = 1; // advantage
				notes.push(`${prof} proficiency → ${nimbleSave} advantage`);
			}
		}
	}

	return field(
		nimbleSaves,
		sb.saveProficiencies.length > 0 ? 'review' : 'auto',
		notes.length > 0 ? notes.join(', ') : undefined,
		`5e save proficiencies: ${sb.saveProficiencies.join(', ') || 'none'}`,
	);
}

export function convertDescription(sb: Dnd5eStatblock): ConversionField<string> {
	const parts: string[] = [];

	if (sb.alignment) parts.push(`<p><strong>Alignment:</strong> ${sb.alignment}</p>`);
	if (sb.senses.length > 0) parts.push(`<p><strong>Senses:</strong> ${sb.senses.join(', ')}</p>`);
	if (sb.languages.length > 0)
		parts.push(`<p><strong>Languages:</strong> ${sb.languages.join(', ')}</p>`);
	if (sb.conditionImmunities.length > 0) {
		parts.push(
			`<p><strong>Condition Immunities:</strong> ${sb.conditionImmunities.join(', ')}</p>`,
		);
	}

	// Store 5e ability scores as reference
	if (Object.keys(sb.abilities).length > 0) {
		const abilityText = Object.entries(sb.abilities)
			.map(
				([key, val]) => `${key.toUpperCase()} ${val.score} (${val.mod >= 0 ? '+' : ''}${val.mod})`,
			)
			.join(', ');
		parts.push(`<p><strong>5e Ability Scores:</strong> ${abilityText}</p>`);
	}

	parts.push(`<p><strong>Challenge Rating:</strong> ${sb.cr}${sb.xp ? ` (${sb.xp} XP)` : ''}</p>`);

	if (sb.description) {
		parts.push(sb.description);
	}

	return field(parts.join('\n'), 'auto');
}

function determineActorType(sb: Dnd5eStatblock): ConversionField<ActorType> {
	if (sb.legendaryActions && sb.legendaryActions.entries.length > 0) {
		return field('soloMonster' as ActorType, 'review', 'Has legendary actions → soloMonster');
	}
	return field('npc' as ActorType, 'auto');
}

// ─── Item Converters ─────────────────────────────────────────────────────────

function createBaseItemData(
	name: string,
	subtype: string,
	description: string,
	icon: string,
	overrides: Record<string, unknown> = {},
): object {
	return {
		_id: generateId(),
		name,
		type: 'monsterFeature',
		img: icon,
		system: {
			macro: '',
			identifier: '',
			rules: [],
			activation: {
				acquireTargetsFromTemplate: false,
				cost: { details: '', quantity: 1, type: 'none', isReaction: false },
				duration: { details: '', quantity: 1, type: 'none' },
				effects: [],
				showDescription: true,
				targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
				template: { length: 1, radius: 1, shape: '', width: 1 },
			},
			description: description ? `<p>${description}</p>` : '',
			subtype,
			parentItemId: '',
			...overrides,
		},
		effects: [],
		folder: null,
		sort: 0,
		flags: {},
	};
}

function convertWeaponAction(action: Dnd5eStatblockAction): ConversionItemReport | null {
	const { parsed } = action;
	if (!parsed || parsed.damage.length === 0) return null;

	const effects: object[] = [];
	const primaryDamage = parsed.damage[0];
	const nimbleDamageType = SHARED_DAMAGE_TYPES.has(primaryDamage.damageType)
		? primaryDamage.damageType
		: 'piercing';

	effects.push({
		id: generateId(),
		type: 'damage',
		damageType: nimbleDamageType,
		formula: primaryDamage.formula,
		parentContext: null,
		parentNode: null,
		canCrit: true,
		canMiss: true,
		on: {
			hit: [
				{
					id: generateId(),
					type: 'damageOutcome',
					outcome: 'fullDamage',
					parentContext: 'hit',
					parentNode: null,
				},
			],
		},
	});

	const attackType = parsed.type === 'ranged' ? 'range' : 'reach';
	const distFeet = parsed.reach ?? parsed.range ?? 5;
	const distance = feetToSquares(distFeet);

	const overrides = {
		activation: {
			acquireTargetsFromTemplate: false,
			cost: { details: '', quantity: 1, type: 'none', isReaction: false },
			duration: { details: '', quantity: 1, type: 'action' },
			effects,
			showDescription: true,
			targets: {
				count: 1,
				restrictions: '',
				attackType,
				distance: Math.max(distance, 1),
			},
			template: { length: 1, radius: 1, shape: '', width: 1 },
		},
	};

	const notes: string[] = [];
	if (parsed.damage.length > 1) {
		notes.push(
			`Additional damage: ${parsed.damage
				.slice(1)
				.map((d) => `${d.formula} ${d.damageType}`)
				.join(', ')}`,
		);
	}
	if (parsed.riders) notes.push(`On hit: ${parsed.riders}`);

	const itemData = createBaseItemData(
		action.name,
		FEATURE_SUBTYPES.action,
		action.description,
		DEFAULT_FEATURE_ICONS.action,
		overrides,
	);

	return {
		name: action.name,
		flag: notes.length > 0 ? 'review' : 'auto',
		note: notes.length > 0 ? notes.join('; ') : undefined,
		itemData,
	};
}

function convertMultiattack(action: Dnd5eStatblockAction): ConversionItemReport {
	const id = generateId();
	const itemData = {
		_id: id,
		name: 'Attack Sequence',
		type: 'monsterFeature',
		img: DEFAULT_FEATURE_ICONS.attackSequence,
		system: {
			macro: '',
			identifier: 'attack-sequence',
			rules: [],
			activation: {
				acquireTargetsFromTemplate: false,
				cost: { details: '', quantity: 1, type: 'none', isReaction: false },
				duration: { details: '', quantity: 1, type: 'none' },
				effects: [],
				showDescription: true,
				targets: { count: 1, restrictions: '' },
				template: { length: 1, radius: 1, shape: '', width: 1 },
			},
			description: `<p>${action.description}</p>`,
			subtype: FEATURE_SUBTYPES.attackSequence,
			parentItemId: '',
		},
		effects: [],
		folder: null,
		sort: 0,
		flags: {},
	};

	return {
		name: 'Multiattack',
		flag: 'review',
		note: 'Multiattack converted to attack sequence — verify action grouping',
		itemData,
	};
}

function convertFeatureToItem(trait: { name: string; description: string }): ConversionItemReport {
	const itemData = createBaseItemData(
		trait.name,
		FEATURE_SUBTYPES.feature,
		trait.description,
		DEFAULT_FEATURE_ICONS.feature,
	);

	return { name: trait.name, flag: 'auto', itemData };
}

function convertReactionToItem(trait: { name: string; description: string }): ConversionItemReport {
	const overrides = {
		activation: {
			acquireTargetsFromTemplate: false,
			cost: { details: '', quantity: 1, type: 'none', isReaction: true },
			duration: { details: '', quantity: 1, type: 'none' },
			effects: [],
			showDescription: true,
			targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
			template: { length: 1, radius: 1, shape: '', width: 1 },
		},
	};

	const itemData = createBaseItemData(
		trait.name,
		FEATURE_SUBTYPES.action,
		trait.description,
		DEFAULT_FEATURE_ICONS.action,
		overrides,
	);

	return { name: trait.name, flag: 'auto', itemData };
}

function convertLegendaryToItem(trait: {
	name: string;
	description: string;
}): ConversionItemReport {
	const itemData = createBaseItemData(
		`(Legendary) ${trait.name}`,
		FEATURE_SUBTYPES.action,
		trait.description,
		DEFAULT_FEATURE_ICONS.action,
	);

	return {
		name: trait.name,
		flag: 'review',
		note: 'Legendary action — manual adjustment required',
		itemData,
	};
}

// ─── Item Pipeline ───────────────────────────────────────────────────────────

export function convertItems(sb: Dnd5eStatblock): {
	items: ConversionItemReport[];
	skipped: SkippedItemReport[];
	attackSequenceId?: string;
} {
	const items: ConversionItemReport[] = [];
	const skipped: SkippedItemReport[] = [];
	let attackSequenceId: string | undefined;

	// Traits (passive features)
	for (const trait of sb.traits) {
		items.push(convertFeatureToItem(trait));
	}

	// Actions
	for (const action of sb.actions) {
		const lowerName = action.name.toLowerCase();

		// Multiattack → attackSequence
		if (lowerName === 'multiattack' || lowerName.startsWith('multiattack')) {
			const result = convertMultiattack(action);
			attackSequenceId = (result.itemData as { _id: string })._id;
			items.push(result);
			continue;
		}

		// Weapon attacks
		if (action.parsed) {
			const result = convertWeaponAction(action);
			if (result) {
				items.push(result);
				continue;
			}
		}

		// Generic action (not parseable as weapon)
		const itemData = createBaseItemData(
			action.name,
			FEATURE_SUBTYPES.action,
			action.description,
			DEFAULT_FEATURE_ICONS.action,
			{
				activation: {
					acquireTargetsFromTemplate: false,
					cost: { details: '', quantity: 1, type: 'none', isReaction: false },
					duration: { details: '', quantity: 1, type: 'action' },
					effects: [],
					showDescription: true,
					targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
					template: { length: 1, radius: 1, shape: '', width: 1 },
				},
			},
		);
		items.push({
			name: action.name,
			flag: 'review',
			note: 'Could not parse attack data — converted as generic action',
			itemData,
		});
	}

	// Bonus actions
	if (sb.bonusActions) {
		for (const action of sb.bonusActions) {
			const itemData = createBaseItemData(
				action.name,
				FEATURE_SUBTYPES.action,
				action.description,
				DEFAULT_FEATURE_ICONS.action,
			);
			items.push({
				name: action.name,
				flag: 'review',
				note: 'Bonus action — verify action economy in Nimble',
				itemData,
			});
		}
	}

	// Reactions
	if (sb.reactions) {
		for (const reaction of sb.reactions) {
			items.push(convertReactionToItem(reaction));
		}
	}

	// Legendary actions
	if (sb.legendaryActions) {
		for (const entry of sb.legendaryActions.entries) {
			items.push(convertLegendaryToItem(entry));
		}
	}

	// Lair actions — skip
	if (sb.lairActions) {
		for (const lair of sb.lairActions) {
			skipped.push({
				name: lair.name,
				reason: 'Lair actions do not map to Nimble — manual conversion required',
				originalText: lair.description,
			});
		}
	}

	// Spellcasting — skip (spell matching handled separately)
	if (sb.spellcasting) {
		const allSpellNames = sb.spellcasting.spells.flatMap((g) => g.names).join(', ');
		skipped.push({
			name: 'Spellcasting',
			reason: 'Spells handled via spell matching — see spell matches section',
			originalText: `DC ${sb.spellcasting.dc ?? '?'}, Spells: ${allSpellNames}`,
		});
	}

	// Set parentItemId for actions that belong to the attack sequence
	if (attackSequenceId) {
		for (const item of items) {
			const itemSystem = (item.itemData as { system?: { subtype?: string; parentItemId?: string } })
				.system;
			if (itemSystem?.subtype === FEATURE_SUBTYPES.action && itemSystem?.parentItemId === '') {
				itemSystem.parentItemId = attackSequenceId;
			}
		}
	}

	return { items, skipped, attackSequenceId };
}

// ─── Warnings ────────────────────────────────────────────────────────────────

export function generateWarnings(sb: Dnd5eStatblock): string[] {
	const warnings: string[] = [];

	if (sb.ac > 20) {
		warnings.push(`High AC (${sb.ac}) — may need adjustment for Nimble expectations`);
	}

	if (sb.cr > 20) {
		warnings.push(
			`High CR (${sb.cr}) — Nimble level balance may differ significantly at this range`,
		);
	}

	if (sb.spellcasting && sb.spellcasting.spells.length > 3) {
		warnings.push('Extensive spell list — manual review strongly recommended');
	}

	if (sb.legendaryActions && sb.legendaryActions.entries.length > 0) {
		warnings.push('Legendary actions do not map directly to Nimble — manual adjustment required');
	}

	// Check for unmapped conditions in action/trait text
	const allText = [
		...sb.traits.map((t) => t.description),
		...sb.actions.map((a) => a.description),
	].join(' ');

	if (/exhaustion/i.test(allText)) {
		warnings.push('References "exhaustion" which has no Nimble equivalent');
	}

	return warnings;
}

// ─── Main Conversion Pipeline ────────────────────────────────────────────────

/**
 * Build a full ConversionReport from a normalized statblock.
 * This is a pure function (no Foundry API calls).
 */
export function buildConversionReport(
	sb: Dnd5eStatblock,
	spellMatches: SpellMatchResult[] = [],
): ConversionReport {
	const { items, skipped } = convertItems(sb);

	return {
		name: convertName(sb),
		actorType: determineActorType(sb),
		sizeCategory: convertSize(sb),
		creatureType: convertCreatureType(sb),
		hp: convertHP(sb),
		armor: convertArmor(sb),
		level: convertLevel(sb),
		movement: convertMovement(sb),
		damageResistances: convertDamageTraits(sb.damageResistances, 'resistance'),
		damageImmunities: convertDamageTraits(sb.damageImmunities, 'immunity'),
		damageVulnerabilities: convertDamageTraits(sb.damageVulnerabilities, 'vulnerability'),
		savingThrows: convertSavingThrows(sb),
		description: convertDescription(sb),
		items,
		skippedItems: skipped,
		spellMatches,
		warnings: generateWarnings(sb),
		sourceRaw: sb.sourceRaw,
		cr: sb.cr,
	};
}

/**
 * Convert a ConversionReport into Foundry Actor.CreateData.
 */
export function toActorData(report: ConversionReport): Actor.CreateData {
	const actorType = report.actorType.value;
	const tokenDimensions = SIZE_TO_TOKEN_DIMENSIONS[report.sizeCategory.value] ?? {
		width: 1,
		height: 1,
	};
	const items = report.items.map((item) => item.itemData);

	return {
		name: report.name.value,
		type: actorType,
		img: DEFAULT_ACTOR_IMAGE,
		system: {
			attributes: {
				armor: report.armor.value,
				damageResistances: report.damageResistances.value,
				damageVulnerabilities: report.damageVulnerabilities.value,
				damageImmunities: report.damageImmunities.value,
				hp: {
					max: report.hp.value,
					temp: 0,
					value: report.hp.value,
				},
				sizeCategory: report.sizeCategory.value,
				movement: report.movement.value,
			},
			description: report.description.value,
			details: {
				creatureType: report.creatureType.value,
				level: report.level.value,
				...(actorType === 'npc' && { isFlunky: false }),
			},
			savingThrows: report.savingThrows.value,
		},
		prototypeToken: {
			name: report.name.value,
			displayName: 50, // OWNER_HOVER
			actorLink: false,
			width: tokenDimensions.width,
			height: tokenDimensions.height,
			texture: { src: DEFAULT_ACTOR_IMAGE },
			lockRotation: true,
			disposition: -1, // HOSTILE
			displayBars: actorType === 'soloMonster' ? 40 : 0,
			bar1: { attribute: 'attributes.hp' },
		},
		flags: {
			nimble: {
				conversion: {
					source: '5e',
					convertedAt: new Date().toISOString(),
					cr: report.cr,
					fieldsNeedingReview: collectReviewFields(report),
					originalAC: parseInt(report.armor.source?.match(/\d+/)?.[0] ?? '0', 10),
				},
			},
		},
		items,
	} as object as Actor.CreateData;
}

function collectReviewFields(report: ConversionReport): string[] {
	const fields: string[] = [];
	const entries: [string, ConversionField][] = [
		['name', report.name],
		['actorType', report.actorType],
		['sizeCategory', report.sizeCategory],
		['creatureType', report.creatureType],
		['hp', report.hp],
		['armor', report.armor],
		['level', report.level],
		['movement', report.movement],
		['damageResistances', report.damageResistances],
		['damageImmunities', report.damageImmunities],
		['damageVulnerabilities', report.damageVulnerabilities],
		['savingThrows', report.savingThrows],
	];

	for (const [name, f] of entries) {
		if (f.flag === 'review') fields.push(name);
	}

	return fields;
}

// ─── Import Functions ────────────────────────────────────────────────────────

/**
 * Create a Nimble actor from a ConversionReport.
 */
export async function importFromReport(
	report: ConversionReport,
	options: ImportOptions = {},
): Promise<ImportResult> {
	try {
		const actorData = toActorData(report);

		if (options.folderId) {
			(actorData as Record<string, unknown>).folder = options.folderId;
		}

		const actor = await Actor.create(actorData);

		return {
			success: true,
			monsterName: report.name.value,
			actorId: actor?.id ?? undefined,
		};
	} catch (error) {
		return {
			success: false,
			monsterName: report.name.value,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Import multiple monsters from conversion reports.
 */
export async function importBatch(
	reports: ConversionReport[],
	options: ImportOptions = {},
): Promise<BatchImportResult> {
	let folderId = options.folderId;
	let createdFolderId: string | undefined;

	if (options.createFolder && options.folderName) {
		const folder = await Folder.create({
			name: options.folderName,
			type: 'Actor',
		});
		folderId = folder?.id ?? undefined;
		createdFolderId = folderId;
	}

	const results: ImportResult[] = [];
	for (const report of reports) {
		const result = await importFromReport(report, { ...options, folderId });
		results.push(result);
	}

	return { results, createdFolderId };
}
