import { UseOptionRule } from '../useOption.js';

const pick = { name: 'Smite', damage: '5', damageType: 'radiant', lowerArmorSteps: 0 };
const dataModel = foundry.abstract.DataModel as unknown as Record<string, unknown>;

describe('a Spell or Attack Option for melee weapons', () => {
	// Foundry's DataModel has a no-op validateJoint that rules call first; the mock has none.
	beforeAll(() => {
		dataModel.validateJoint = () => undefined;
	});
	afterAll(() => {
		delete dataModel.validateJoint;
	});

	it('fails validation without a pick, and says why', () => {
		expect(() => UseOptionRule.validateJoint({ target: 'meleeWeapon', picks: [] })).toThrow(
			'An option for melee weapons needs at least one pick.',
		);
	});

	it('passes with a pick', () => {
		expect(() =>
			UseOptionRule.validateJoint({ target: 'meleeWeapon', picks: [pick] }),
		).not.toThrow();
	});

	it('needs no pick as an option for spells', () => {
		expect(() => UseOptionRule.validateJoint({ target: 'spell', picks: [] })).not.toThrow();
	});
});
