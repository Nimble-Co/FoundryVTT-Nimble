import { describe, expect, it, vi } from 'vitest';
import type { UpcastContext } from './applyUpcastDeltas.js';
import { applyUpcastDeltas } from './applyUpcastDeltas.js';

// Mock foundry.utils.deepClone and foundry.utils.randomID
globalThis.foundry = {
	utils: {
		deepClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
		randomID: vi.fn(() => `test-id-${Math.random().toString(36).substring(2, 11)}`),
	},
} as any;

// ── Spell JSON Imports ──────────────────────────────────────────────────────
// Fire
import ignite from '../../../packs/spells/core/fire/ignite.json';
import pyroclasm from '../../../packs/spells/core/fire/pyroclasm.json';
import fieryEmbrace from '../../../packs/spells/core/fire/fiery-embrace.json';

// Ice
import arcticBlast from '../../../packs/spells/core/ice/arctic-blast.json';
import glacierStrike from '../../../packs/spells/core/ice/glacier-strike.json';
import rimeblades from '../../../packs/spells/core/ice/rimeblades.json';
import cryosleep from '../../../packs/spells/core/ice/cryosleep.json';

// Lightning
import arcLightning from '../../../packs/spells/core/lightning/arc-lightning.json';
import alacrity from '../../../packs/spells/core/lightning/alacrity.json';
import stormlash from '../../../packs/spells/core/lightning/stormlash.json';
import electrickery from '../../../packs/spells/core/lightning/electrickery.json';
import electrocharge from '../../../packs/spells/core/lightning/electrocharge.json';
import rideTheLightning from '../../../packs/spells/core/lightning/ride-the-lightning.json';

// Wind
import fly from '../../../packs/spells/core/wind/fly.json';
import eyeOfTheStorm from '../../../packs/spells/core/wind/eye-of-the-storm.json';
import thousandCuts from '../../../packs/spells/core/wind/thousand-cuts.json';
import updraft from '../../../packs/spells/core/wind/updraft.json';
import boisterousWinds from '../../../packs/spells/core/wind/boisterous-winds.json';

// Radiant
import heal from '../../../packs/spells/core/radiant/heal.json';
import wardingBond from '../../../packs/spells/core/radiant/warding-bond.json';
import shieldOfJustice from '../../../packs/spells/core/radiant/shield-of-justice.json';
import condemn from '../../../packs/spells/core/radiant/condemn.json';
import vengeance from '../../../packs/spells/core/radiant/vengeance.json';
import sacrifice from '../../../packs/spells/core/radiant/sacrifice.json';

// Necrotic
import vampiricGreed from '../../../packs/spells/core/necrotic/vampiric-greed.json';
import gangrenousBurst from '../../../packs/spells/core/necrotic/gangrenous-burst.json';
import unspeakableWord from '../../../packs/spells/core/necrotic/unspeakable-word.json';
import creepingDeath from '../../../packs/spells/core/necrotic/creeping-death.json';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createContext(spellData: any, manaToSpend: number, choiceIndex?: number): UpcastContext {
	return {
		spell: {
			tier: spellData.system.tier,
			scaling: spellData.system.scaling,
		},
		actor: {
			resources: {
				mana: { current: 20 },
				highestUnlockedSpellTier: 9,
			},
		},
		activationData: spellData.system.activation,
		manaToSpend,
		choiceIndex,
	};
}

/** Shorthand: create context for exactly N upcast steps */
function ctxWithSteps(spellData: any, steps: number, choiceIndex?: number): UpcastContext {
	return createContext(spellData, spellData.system.tier + steps, choiceIndex);
}

/** Recursively finds an effect node by ID in the effect tree. */
function findNodeById(effects: any[], id: string): any {
	for (const node of effects) {
		if (node.id === id) return node;
		if (node.on) {
			for (const key of Object.keys(node.on)) {
				const found = findNodeById(node.on[key], id);
				if (found) return found;
			}
		}
		if (node.sharedRolls) {
			const found = findNodeById(node.sharedRolls, id);
			if (found) return found;
		}
	}
	return null;
}

// ── Integration Tests ───────────────────────────────────────────────────────

describe('Spell Data Integration Tests', () => {
	describe('Fire Spells', () => {
		it('Ignite - addFlatDamage +10', () => {
			const result = applyUpcastDeltas(ctxWithSteps(ignite, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const dmg = result.activationData.effects.find((e: any) => e.type === 'damage') as any;
			expect(dmg.formula).toContain('+10');
		});

		it('Pyroclasm - addAreaSize +1 and addFlatDamage +2 on nested node', () => {
			const result = applyUpcastDeltas(ctxWithSteps(pyroclasm, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const nestedDmg = findNodeById(result.activationData.effects, 'Hu4R2ygwKhl9UR0E');
			expect(nestedDmg).not.toBeNull();
			expect(nestedDmg.formula).toContain('+2');
		});

		it('Fiery Embrace - addTargets +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(fieryEmbrace, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.targets!.count).toBe(
				fieryEmbrace.system.activation.targets.count + 1,
			);
		});
	});

	describe('Ice Spells', () => {
		it('Arctic Blast - addAreaSize +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(arcticBlast, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const tmpl = result.activationData.template!;
			const origTmpl = arcticBlast.system.activation.template;
			expect(tmpl.radius! + tmpl.length!).toBeGreaterThan(origTmpl.radius + origTmpl.length);
		});

		it('Glacier Strike - addAreaSize +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(glacierStrike, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Rimeblades - addFlatDamage +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(rimeblades, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const dmg = result.activationData.effects.find((e: any) => e.type === 'damage') as any;
			expect(dmg.formula).toContain('+1');
		});

		it('Cryosleep - addAreaSize +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(cryosleep, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});
	});

	describe('Lightning Spells', () => {
		it('Arc Lightning - addFlatDamage +4 (1 step)', () => {
			const result = applyUpcastDeltas(ctxWithSteps(arcLightning, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const dmg = result.activationData.effects.find((e: any) => e.type === 'damage') as any;
			expect(dmg.formula).toBe('3d8+4');
		});

		it('Arc Lightning - addFlatDamage +12 (3 steps)', () => {
			const result = applyUpcastDeltas(ctxWithSteps(arcLightning, 3));

			expect(result.upcastResult.upcastSteps).toBe(3);
			const dmg = result.activationData.effects.find((e: any) => e.type === 'damage') as any;
			expect(dmg.formula).toBe('3d8+12');
		});

		it('Alacrity - addRange +4', () => {
			const result = applyUpcastDeltas(ctxWithSteps(alacrity, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Stormlash - addFlatDamage +4', () => {
			const result = applyUpcastDeltas(ctxWithSteps(stormlash, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const dmg = result.activationData.effects.find((e: any) => e.type === 'damage') as any;
			expect(dmg.formula).toContain('+4');
		});

		it('Electrickery - addRange +2', () => {
			const result = applyUpcastDeltas(ctxWithSteps(electrickery, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Electrocharge - addRange +4', () => {
			const result = applyUpcastDeltas(ctxWithSteps(electrocharge, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Ride the Lightning - addDC +1 on nested savingThrow', () => {
			const result = applyUpcastDeltas(ctxWithSteps(rideTheLightning, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const saveNode = findNodeById(result.activationData.effects, 'sklq8bAt2H8fc8lm');
			expect(saveNode).not.toBeNull();
			expect(saveNode.saveDC).toBeDefined();
		});
	});

	describe('Wind Spells', () => {
		it('Fly - addTargets +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(fly, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.targets!.count).toBe(fly.system.activation.targets.count + 1);
		});

		it('Eye of the Storm - addReach +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(eyeOfTheStorm, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Thousand Cuts - addReach +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(thousandCuts, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Updraft - addRange +2 and addAreaSize +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(updraft, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.upcastResult.appliedDeltas).toHaveLength(2);
		});

		it('Boisterous Winds - upcastChoice: +1 minute duration', () => {
			const result = applyUpcastDeltas(ctxWithSteps(boisterousWinds, 1, 0));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.upcastResult.choiceLabel).toBe('+1 minute');
			expect(result.activationData.duration!.quantity).toBe(
				boisterousWinds.system.activation.duration.quantity + 1,
			);
		});

		it('Boisterous Winds - upcastChoice: +2 targets', () => {
			const result = applyUpcastDeltas(ctxWithSteps(boisterousWinds, 1, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.upcastResult.choiceLabel).toBe('+2 targets');
			expect(result.activationData.targets!.count).toBe(
				boisterousWinds.system.activation.targets.count + 2,
			);
		});
	});

	describe('Radiant Spells', () => {
		it('Heal - upcastChoice: +1 target', () => {
			const result = applyUpcastDeltas(ctxWithSteps(heal, 1, 0));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.upcastResult.choiceLabel).toBe('+1 target');
			expect(result.activationData.targets!.count).toBe(heal.system.activation.targets.count + 1);
		});

		it('Heal - upcastChoice: +4 reach', () => {
			const result = applyUpcastDeltas(ctxWithSteps(heal, 1, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.upcastResult.choiceLabel).toBe('+4 reach');
		});

		it('Heal - upcastChoice: +1d6 healing', () => {
			const result = applyUpcastDeltas(ctxWithSteps(heal, 1, 2));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.upcastResult.choiceLabel).toBe('+1d6 healing');
			const healNode = result.activationData.effects.find((e: any) => e.type === 'healing') as any;
			expect(healNode.formula).toBe('1d6+@key+1d6');
		});

		it('Heal - upcastChoice: +1d6 healing with 3 steps', () => {
			const result = applyUpcastDeltas(ctxWithSteps(heal, 3, 2));

			expect(result.upcastResult.upcastSteps).toBe(3);
			const healNode = result.activationData.effects.find((e: any) => e.type === 'healing') as any;
			expect(healNode.formula).toBe('1d6+@key+3d6');
		});

		it('Warding Bond - addTargets +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(wardingBond, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.targets!.count).toBe(
				wardingBond.system.activation.targets.count + 1,
			);
		});

		it('Shield of Justice - addArmor +5 (no-op)', () => {
			const result = applyUpcastDeltas(ctxWithSteps(shieldOfJustice, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			// addArmor is currently a no-op, should not throw
		});

		it('Condemn - addReach +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(condemn, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Vengeance - addReach +1', () => {
			const result = applyUpcastDeltas(ctxWithSteps(vengeance, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});

		it('Sacrifice - addReach +4', () => {
			const result = applyUpcastDeltas(ctxWithSteps(sacrifice, 1));
			expect(result.upcastResult.upcastSteps).toBe(1);
		});
	});

	describe('Necrotic Spells', () => {
		it('Vampiric Greed - addDC +1 on nested savingThrow', () => {
			const result = applyUpcastDeltas(ctxWithSteps(vampiricGreed, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const saveNode = findNodeById(result.activationData.effects, 'JeRAFUXZteYotazu');
			expect(saveNode).not.toBeNull();
			expect(saveNode.saveDC).toBe(1); // 0 + 1*1
		});

		it('Gangrenous Burst - addFlatDamage +10 on nested damage', () => {
			const result = applyUpcastDeltas(ctxWithSteps(gangrenousBurst, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const dmgNode = findNodeById(result.activationData.effects, 'jzwoyVS12oyagYY5');
			expect(dmgNode).not.toBeNull();
			expect(dmgNode.formula).toBe('3d20+10');
		});

		it('Gangrenous Burst - 2 upcast steps should add +20', () => {
			const result = applyUpcastDeltas(ctxWithSteps(gangrenousBurst, 2));

			expect(result.upcastResult.upcastSteps).toBe(2);
			const dmgNode = findNodeById(result.activationData.effects, 'jzwoyVS12oyagYY5');
			expect(dmgNode.formula).toBe('3d20+20');
		});

		it('Unspeakable Word - addDC +1 and addFlatDamage +10 on nested nodes', () => {
			const result = applyUpcastDeltas(ctxWithSteps(unspeakableWord, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const saveNode = findNodeById(result.activationData.effects, 'xFH2PgXT97EPr8jr');
			expect(saveNode).not.toBeNull();
			expect(saveNode.saveDC).toBe(1);

			const dmgNode = findNodeById(result.activationData.effects, 'UYavQJvOx4gcSfbg');
			expect(dmgNode).not.toBeNull();
			expect(dmgNode.formula).toBe('max((1d6*10),(1d6*10))+1d6+10');
		});

		it('Creeping Death - addDice +1d20', () => {
			const result = applyUpcastDeltas(ctxWithSteps(creepingDeath, 1));

			expect(result.upcastResult.upcastSteps).toBe(1);
			const dmg = result.activationData.effects.find((e: any) => e.type === 'damage') as any;
			expect(dmg.formula).toBe('4d20+1d20');
		});

		it('Creeping Death - 2 upcast steps should add +2d20', () => {
			const result = applyUpcastDeltas(ctxWithSteps(creepingDeath, 2));

			expect(result.upcastResult.upcastSteps).toBe(2);
			const dmg = result.activationData.effects.find((e: any) => e.type === 'damage') as any;
			expect(dmg.formula).toBe('4d20+2d20');
		});
	});

	describe('All Upcastable Spells - Smoke Test', () => {
		const allSpells = [
			{ name: 'Ignite', data: ignite },
			{ name: 'Pyroclasm', data: pyroclasm },
			{ name: 'Fiery Embrace', data: fieryEmbrace },
			{ name: 'Arctic Blast', data: arcticBlast },
			{ name: 'Glacier Strike', data: glacierStrike },
			{ name: 'Rimeblades', data: rimeblades },
			{ name: 'Cryosleep', data: cryosleep },
			{ name: 'Arc Lightning', data: arcLightning },
			{ name: 'Alacrity', data: alacrity },
			{ name: 'Stormlash', data: stormlash },
			{ name: 'Electrickery', data: electrickery },
			{ name: 'Electrocharge', data: electrocharge },
			{ name: 'Ride the Lightning', data: rideTheLightning },
			{ name: 'Fly', data: fly },
			{ name: 'Eye of the Storm', data: eyeOfTheStorm },
			{ name: 'Thousand Cuts', data: thousandCuts },
			{ name: 'Updraft', data: updraft },
			{ name: 'Boisterous Winds', data: boisterousWinds },
			{ name: 'Heal', data: heal },
			{ name: 'Warding Bond', data: wardingBond },
			{ name: 'Shield of Justice', data: shieldOfJustice },
			{ name: 'Condemn', data: condemn },
			{ name: 'Vengeance', data: vengeance },
			{ name: 'Sacrifice', data: sacrifice },
			{ name: 'Vampiric Greed', data: vampiricGreed },
			{ name: 'Gangrenous Burst', data: gangrenousBurst },
			{ name: 'Unspeakable Word', data: unspeakableWord },
			{ name: 'Creeping Death', data: creepingDeath },
		];

		for (const spell of allSpells) {
			const scaling = spell.data.system.scaling;
			const tier = spell.data.system.tier;

			if (scaling.mode === 'upcast') {
				it(`${spell.name} (tier ${tier}) - should upcast without errors`, () => {
					const ctx = createContext(spell.data, tier + 1);
					const result = applyUpcastDeltas(ctx);

					expect(result.upcastResult.isUpcast).toBe(true);
					expect(result.upcastResult.upcastSteps).toBe(1);
					expect(result.upcastResult.appliedDeltas.length).toBeGreaterThan(0);
				});
			} else if (scaling.mode === 'upcastChoice') {
				for (let i = 0; i < (scaling.choices?.length ?? 0); i++) {
					const choiceLabel = scaling.choices![i].label;
					it(`${spell.name} (tier ${tier}) - choice "${choiceLabel}" should upcast without errors`, () => {
						const ctx = createContext(spell.data, tier + 1, i);
						const result = applyUpcastDeltas(ctx);

						expect(result.upcastResult.isUpcast).toBe(true);
						expect(result.upcastResult.upcastSteps).toBe(1);
						expect(result.upcastResult.choiceLabel).toBe(choiceLabel);
					});
				}
			}
		}
	});
});
