import type { NimbleCharacter } from '#documents/actor/character.js';

function formatModifier(value: number): string {
	if (value >= 0) return `+${value}`;
	return `${value}`;
}

function extractCharacterData(actor: NimbleCharacter) {
	const system = actor.system;

	const classEntries = Object.values(actor.classes ?? {});
	const classItem = classEntries[0];
	const className = classItem?.name ?? '';

	const ancestryName = actor.ancestry?.name ?? '';
	const characterLevel = actor.levels.character;
	const ancestryClassLevel = [ancestryName, className, `Lvl ${characterLevel}`]
		.filter(Boolean)
		.join(', ');

	const height = system.details?.height ?? '';
	const weight = system.details?.weight ?? '';
	const walkSpeed = system.attributes.movement?.walk ?? 6;
	const heightWeightSpeed = [height, weight, `${walkSpeed} spaces`].filter(Boolean).join(', ');

	const hitDiceMax = actor.HitDiceManager?.max ?? 0;
	const hitDieSize = actor.HitDiceManager?.largest ?? 8;
	const hitDice = `${hitDiceMax} d${hitDieSize}`;

	const hpMax = system.attributes.hp.max;
	const hitPoints = `${hpMax}`;

	const armor = system.attributes.armor.value.toString();
	const initiative = formatModifier(system.attributes.initiative.mod);
	const woundsMax = system.attributes.wounds.max;
	const wounds = `${woundsMax}`;

	const abilities = {
		strength: formatModifier(system.abilities.strength.mod),
		dexterity: formatModifier(system.abilities.dexterity.mod),
		intelligence: formatModifier(system.abilities.intelligence.mod),
		will: formatModifier(system.abilities.will.mod),
	};

	const saveRollModes = {
		strength: system.savingThrows?.strength?.defaultRollMode ?? 0,
		dexterity: system.savingThrows?.dexterity?.defaultRollMode ?? 0,
		intelligence: system.savingThrows?.intelligence?.defaultRollMode ?? 0,
		will: system.savingThrows?.will?.defaultRollMode ?? 0,
	};

	const skills = {
		arcana: formatModifier(system.skills.arcana.mod),
		examination: formatModifier(system.skills.examination.mod),
		finesse: formatModifier(system.skills.finesse.mod),
		influence: formatModifier(system.skills.influence.mod),
		insight: formatModifier(system.skills.insight.mod),
		lore: formatModifier(system.skills.lore.mod),
		might: formatModifier(system.skills.might.mod),
		naturecraft: formatModifier(system.skills.naturecraft.mod),
		perception: formatModifier(system.skills.perception.mod),
		stealth: formatModifier(system.skills.stealth.mod),
	};

	return {
		characterName: actor.name ?? 'Unknown',
		ancestryClassLevel,
		heightWeightSpeed,
		hitDice,
		hitPoints,
		armor,
		initiative,
		wounds,
		abilities,
		saveRollModes,
		skills,
	};
}

export { extractCharacterData };
