/**
 * Preset scenarios for the Nimble dice testbench.
 *
 * Each scenario is a complete Roll Builder configuration. Clicking a scenario
 * in the left column replaces ALL builder state with the scenario's values
 * (fields left undefined fall back to the defaults documented in `Scenario`).
 *
 * To add a new scenario: append a new object to the `scenarios` array below.
 * Keep entries grouped roughly by the engine behavior they exercise, and
 * write the `note` in the voice of a tester — what should I look for when I
 * click this and roll?
 */

/**
 * Roll Builder configuration for a testbench scenario.
 *
 * All fields are optional. Unset fields apply these defaults when the
 * scenario is loaded into the builder:
 *
 *   formula            = '1d8'
 *   isVicious          = false
 *   canCrit            = true
 *   canMiss            = true
 *   primaryDieAsDamage = true
 *   templateShape      = ''       (no AoE)
 *   weaponType         = ''       (permissive, any wielder can crit)
 *   advCount           = 0
 *   disCount           = 0
 *   forceCrit          = false
 *   forceMiss          = false
 */
export type Scenario = {
	/** Stable identifier, used as a key in `{#each}`. */
	id: string;
	/** Short label shown on the scenario button. */
	label: string;
	/** Optional hint explaining what to look for after rolling. */
	note?: string;
	formula?: string;
	isVicious?: boolean;
	canCrit?: boolean;
	canMiss?: boolean;
	primaryDieAsDamage?: boolean;
	templateShape?: string;
	weaponType?: string;
	advCount?: number;
	disCount?: number;
	forceCrit?: boolean;
	forceMiss?: boolean;
	brutalPrimary?: boolean;
};

export const scenarios: Scenario[] = [
	// --- Baselines ---
	{
		id: 'basic-1d8',
		label: 'Basic 1d8',
		note: 'Sanity check — one weapon die, no modifiers. Roll to see a normal hit/crit/miss.',
		formula: '1d8',
	},
	{
		id: 'adv-2d6',
		label: '2d6 with advantage',
		note: 'The headline case. Roll a few times — with advantage, a leftmost tied low die must be dropped so the primary becomes the next-leftmost die.',
		formula: '2d6',
		advCount: 1,
	},
	{
		id: 'adv-dis-cancel',
		label: 'Adv + Dis cancel (net 0)',
		note: 'One advantage and one disadvantage source. Net rollMode should be 0 — no extra dice added to the pool.',
		formula: '2d6',
		advCount: 1,
		disCount: 1,
	},
	{
		id: 'adv-dis-stress',
		label: 'Stress: 3 adv + 2 dis (net +1)',
		note: 'Three advantage and two disadvantage sources. Net should be +1 advantage — one extra die in the primary pool.',
		formula: '2d6',
		advCount: 3,
		disCount: 2,
	},

	// --- Crit mechanics ---
	{
		id: 'vicious-d12-crit',
		label: 'Vicious d12 — Force Crit',
		note: 'Force the primary d12 to max. Explosion chain should fire, and the vicious bonus die should roll once the crit is locked in.',
		formula: '1d12',
		isVicious: true,
		forceCrit: true,
	},
	{
		id: 'greatsword-3d4-crit',
		label: 'Greatsword 3d4 — Force Crit',
		note: 'Only the leftmost d4 of three is primary. Force it to max and watch the d4 explosion chain (d4 chains tend to be long).',
		formula: '3d4',
		forceCrit: true,
	},
	{
		id: 'crossbow-4d4-adv',
		label: 'Crossbow 4d4 with advantage',
		note: 'Largest same-type primary pool in core. Advantage should add ONE extra d4 (not four), and only the leftmost non-discarded die is primary.',
		formula: '4d4',
		advCount: 1,
	},
	{
		id: 'sling-dis2-vicious-crit',
		label: 'Sling dis×2 + Vicious Force Crit',
		note: 'Two disadvantage sources (e.g. adjacent + long range) on a vicious sling. Force crit to verify the vicious explosion still fires even through stacked disadvantage.',
		formula: '1d4',
		isVicious: true,
		disCount: 2,
		forceCrit: true,
	},

	// --- Miss mechanics ---
	{
		id: 'sneak-attack-miss',
		label: 'Sneak Attack with primary MISS',
		note: 'Primary 1d10 forced to 1. Bonus 2d6 sneak attack still rolls but outcome is MISS — bonus dice never rescue a missed primary.',
		formula: '1d10 + 2d6',
		forceMiss: true,
	},
	{
		id: 'vicious-miss',
		label: 'Vicious + Force Miss',
		note: 'A vicious weapon with the primary forced to 1. Crit must not fire, and no vicious explosion should occur.',
		formula: '1d8',
		isVicious: true,
		forceMiss: true,
	},

	// --- Flag suppression ---
	{
		id: 'aoe-cone-1d8',
		label: 'AoE cone 1d8',
		note: 'Template shape is set. canCrit and canMiss should both force to false regardless of the checkbox state. Outcome banner should always read HIT.',
		formula: '1d8',
		templateShape: 'cone',
	},
	{
		id: 'multi-target-3d6',
		label: 'Multi-target 3d6 (no template)',
		note: 'Three targets without a template shape. Per the Magic Missile rule, crit and miss should still work normally — targets.count alone is NOT an AoE signal.',
		formula: '3d6',
	},
	{
		id: 'nonprof-weapon',
		label: 'Non-proficient weapon (Longsword)',
		note: 'Set the weapon type to Longsword, then pick an actor that does NOT have Longsword in their proficiencies. Crit should be suppressed for non-proficiency — force a crit and verify it does not fire.',
		formula: '1d8',
		weaponType: 'Longsword',
		forceCrit: true,
	},
	{
		id: 'minion-1d6',
		label: 'Minion 1d6 attack',
		note: 'Pick a minion actor for this one. Force crit — minions cannot crit regardless of the primary rolling max.',
		formula: '1d6',
		forceCrit: true,
	},
	{
		id: 'minion-aoe-double',
		label: 'Minion + AoE cone (double suppression)',
		note: 'Pick a minion actor. Both minion flag AND AoE template flag suppress crits. Verify the panel shows a plain HIT and no crit was attempted.',
		formula: '2d6',
		templateShape: 'cone',
		forceCrit: true,
	},

	// --- Gnarly interactions ---
	{
		id: 'primary-excluded-vicious-crit',
		label: 'primaryDieAsDamage=false + Vicious Crit',
		note: 'The gnarly one. Force the primary to max on a vicious weapon with primaryDieAsDamage=false. The base primary die value should NOT count toward damage, but the explosion dice should.',
		formula: '1d8',
		isVicious: true,
		primaryDieAsDamage: false,
		forceCrit: true,
	},
	{
		id: 'primary-excluded-plain',
		label: 'primaryDieAsDamage=false (plain)',
		note: 'Baseline for the exclusion path. The primary die rolls normally but its value is excluded from total. Good way to verify the exclusion logic in isolation.',
		formula: '1d8 + 2d6',
		primaryDieAsDamage: false,
	},

	// --- Spells ---
	{
		id: 'vicious-mockery-crit',
		label: 'Vicious Mockery 1d4 — Force Crit',
		note: 'A cantrip going through the same crit pipeline as a weapon. Force crit on a d4 primary and verify the chain renders cleanly.',
		formula: '1d4',
		forceCrit: true,
	},
	{
		id: 'sneak-2d20-bonus',
		label: 'Sneak Attack 2d20 (level 15 Cheat)',
		note: "Sneak Attack at level 15 becomes 2d20. Unusual bonus die size — verify the bonus dice render correctly and don't try to crit-explode (bonus dice never crit).",
		formula: '1d6 + 2d20',
	},

	// --- Modifier-mode scenarios ---
	{
		id: 'dravok-4d4cv',
		label: 'Dravok 4d4cv',
		formula: '4d4cv',
		note: 'Every d4 can crit independently, each with vicious explosion. Roll several times — any d4 that hits 4 should spawn a vicious chain. Check critCount reflects how many base dice critted (not chain dice).',
	},
	{
		id: 'd66-2d6n',
		label: 'd66 roll 2d6n',
		formula: '2d6n',
		canCrit: false,
		canMiss: false,
		note: 'Neutral dice — no crit, no miss. Rolling max should NOT trigger a critical hit.',
	},
	{
		id: 'mixed-1d8cv-2d6',
		label: 'Vicious + bonus 1d8cv + 2d6',
		formula: '1d8cv + 2d6',
		note: 'Primary d8 crits viciously, 2d6 is plain damage. Only the d8 should trigger crit detection.',
	},
	{
		id: 'aoe-modifier-2d8n',
		label: 'AoE via modifier 2d8n',
		formula: '2d8n',
		canCrit: false,
		canMiss: false,
		note: 'AoE-style damage via n modifier. No crit, no miss — outcome should always be HIT.',
	},

	// --- Brutal trait scenarios ---
	{
		id: 'brutal-3d8c',
		label: 'Brutal 3d8c',
		formula: '3d8c',
		brutalPrimary: true,
		note: 'Brutal trait: highest-value die becomes primary (set via roll option, not formula). Roll a few times — primary should shift to whichever d8 rolled highest.',
	},
	{
		id: 'brutal-dravok-4d4cv',
		label: 'Brutal Dravok 4d4cv',
		formula: '4d4cv',
		brutalPrimary: true,
		note: 'Dravok + Brutal: highest-value d4 is primary. Vicious explosions still fire on any d4 that crits. Check that primary shifts to the highest roller.',
	},
];
