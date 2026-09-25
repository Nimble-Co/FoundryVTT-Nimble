import { SYSTEM_ID } from '#system';
import { concentrationChoices, promptForConcentrationToEnd } from './endOneConcentration.js';

function createHeldConcentration(track: string, { spell = '' }: { spell?: string } = {}) {
	return {
		id: `concentration-${track}`,
		statuses: new Set(['concentration']),
		origin: spell ? `Item.${spell}` : null,
		getFlag: (scope: string, key: string) =>
			scope === SYSTEM_ID && key === 'concentrationTrack' ? track : undefined,
	};
}

const dialogApi = foundry.applications.api.DialogV2 as { wait?: unknown };
const dialog = () => dialogApi.wait as ReturnType<typeof vi.fn>;

beforeEach(() => {
	dialogApi.wait = vi.fn();
	vi.stubGlobal('fromUuidSync', (uuid: string) => ({ name: uuid.replace('Item.', '') }));
});

afterEach(() => {
	dialogApi.wait = undefined;
});

describe('concentrationChoices', () => {
	it('names a tracked concentration by its spell and school', () => {
		const held = createHeldConcentration('wind', { spell: 'Fly' });

		expect(concentrationChoices([held])).toEqual([{ id: held.id, label: 'Fly (Wind)' }]);
	});

	it('names an untracked concentration by its spell alone', () => {
		const held = createHeldConcentration('default', { spell: 'Enchant Weapon' });

		expect(concentrationChoices([held])).toEqual([{ id: held.id, label: 'Enchant Weapon' }]);
	});

	it('falls back to the school when the spell is not known', () => {
		expect(concentrationChoices([createHeldConcentration('lightning')])).toEqual([
			{ id: 'concentration-lightning', label: 'Lightning' },
		]);
	});
});

describe('promptForConcentrationToEnd', () => {
	it('asks nothing when only one concentration is held', async () => {
		const held = createHeldConcentration('wind', { spell: 'Fly' });

		expect(await promptForConcentrationToEnd([held])).toEqual([held.id]);
		expect(dialog()).not.toHaveBeenCalled();
	});

	it('ends only the track the player picked', async () => {
		const lightning = createHeldConcentration('lightning');
		const wind = createHeldConcentration('wind');
		dialog().mockResolvedValue(wind.id);

		expect(await promptForConcentrationToEnd([lightning, wind])).toEqual([wind.id]);
	});

	it('ends every track when the player asks for all of them', async () => {
		const lightning = createHeldConcentration('lightning');
		const wind = createHeldConcentration('wind');
		dialog().mockResolvedValue('all');

		expect(await promptForConcentrationToEnd([lightning, wind])).toEqual([lightning.id, wind.id]);
	});

	it('ends nothing when the choice is dismissed', async () => {
		dialog().mockResolvedValue(null);

		expect(
			await promptForConcentrationToEnd([
				createHeldConcentration('lightning'),
				createHeldConcentration('wind'),
			]),
		).toEqual([]);
	});
});
