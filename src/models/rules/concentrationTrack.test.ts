import { ConcentrationTrackRule } from './concentrationTrack.js';

interface MockActor {
	system: { concentrationTracks?: Set<string> };
	getRollData: ReturnType<typeof vi.fn>;
}

function createMockActor(): MockActor {
	return { system: {}, getRollData: vi.fn(() => ({})) };
}

function createRule(
	config: { schools?: string[]; disabled?: boolean },
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): ConcentrationTrackRule {
	const item = {
		isEmbedded: itemOptions?.isEmbedded ?? true,
		actor,
		name: 'Master of Storm',
		uuid: 'test-item-uuid',
	};

	const sourceData = {
		schools: config.schools ?? ['lightning', 'wind'],
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'concentrationTrack',
	};

	const rule = new ConcentrationTrackRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			ConcentrationTrackRule['schema']['fields']
		>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	(rule as any).schools = sourceData.schools;
	(rule as any).disabled = sourceData.disabled;

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });

	return rule;
}

describe('ConcentrationTrackRule', () => {
	it('publishes its schools as separately tracked concentrations', () => {
		const actor = createMockActor();

		createRule({ schools: ['lightning', 'wind'] }, actor).afterPrepareData();

		expect(actor.system.concentrationTracks).toEqual(new Set(['lightning', 'wind']));
	});

	it('accumulates the schools of two rules on the same actor', () => {
		const actor = createMockActor();

		createRule({ schools: ['lightning'] }, actor).afterPrepareData();
		createRule({ schools: ['fire'] }, actor).afterPrepareData();

		expect(actor.system.concentrationTracks).toEqual(new Set(['lightning', 'fire']));
	});

	it('publishes nothing from a rule on an unowned item', () => {
		const actor = createMockActor();

		createRule({}, actor, { isEmbedded: false }).afterPrepareData();

		expect(actor.system.concentrationTracks).toBeUndefined();
	});

	it('publishes nothing when the rule names no school', () => {
		const actor = createMockActor();

		createRule({ schools: [] }, actor).afterPrepareData();

		expect(actor.system.concentrationTracks).toBeUndefined();
	});

	it('is listed under the conditions group with a localizable description', () => {
		expect(ConcentrationTrackRule.group).toBe('conditions');
		expect(ConcentrationTrackRule.description).toBe('NIMBLE.rules.concentrationTrack.description');
	});
});
