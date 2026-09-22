import { SYSTEM_ID } from '#system';
import { NimbleBaseActor } from './base.svelte.js';

function createHeldConcentration(track: string) {
	return {
		id: `concentration-${track}`,
		statuses: new Set(['concentration']),
		getFlag: (scope: string, key: string) =>
			scope === SYSTEM_ID && key === 'concentrationTrack' ? track : undefined,
	};
}

type ToggleHost = {
	toggleStatusEffect(statusId: string, options?: { active?: boolean }): Promise<unknown>;
	deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
};

/** Built on the prototype so the real override runs over the mocked core method. */
function createConcentratingActor(held: ReturnType<typeof createHeldConcentration>[]) {
	return Object.assign(Object.create(NimbleBaseActor.prototype), {
		effects: held,
		statuses: new Set(held.length > 0 ? ['concentration'] : []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	}) as ToggleHost;
}

const dialog = () => foundry.applications.api.DialogV2.wait as ReturnType<typeof vi.fn>;
const coreToggle = () =>
	Object.getPrototypeOf(NimbleBaseActor.prototype).toggleStatusEffect as ReturnType<typeof vi.fn>;

beforeEach(() => {
	dialog().mockReset();
	vi.spyOn(Object.getPrototypeOf(NimbleBaseActor.prototype), 'toggleStatusEffect');
});

describe('NimbleBaseActor#toggleStatusEffect concentration', () => {
	it('asks which track to end when two are held, and ends only that one', async () => {
		const lightning = createHeldConcentration('lightning');
		const wind = createHeldConcentration('wind');
		const actor = createConcentratingActor([lightning, wind]);
		dialog().mockResolvedValue(wind.id);

		await actor.toggleStatusEffect('concentration');

		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [wind.id]);
		expect(coreToggle()).not.toHaveBeenCalled();
	});

	it('leaves both in place when the choice is dismissed', async () => {
		const actor = createConcentratingActor([
			createHeldConcentration('lightning'),
			createHeldConcentration('wind'),
		]);
		dialog().mockResolvedValue(null);

		await actor.toggleStatusEffect('concentration', { active: false });

		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(coreToggle()).not.toHaveBeenCalled();
	});

	it('goes straight to the core toggle when one concentration is held', async () => {
		const actor = createConcentratingActor([createHeldConcentration('default')]);

		await actor.toggleStatusEffect('concentration', { active: false });

		expect(dialog()).not.toHaveBeenCalled();
		expect(coreToggle()).toHaveBeenCalledWith('concentration', { active: false });
	});

	it('goes straight to the core toggle when concentration is being applied', async () => {
		const actor = createConcentratingActor([
			createHeldConcentration('lightning'),
			createHeldConcentration('wind'),
		]);

		await actor.toggleStatusEffect('concentration', { active: true });

		expect(dialog()).not.toHaveBeenCalled();
		expect(coreToggle()).toHaveBeenCalledWith('concentration', { active: true });
	});

	it('leaves every other condition to the core toggle', async () => {
		const actor = createConcentratingActor([
			createHeldConcentration('lightning'),
			createHeldConcentration('wind'),
		]);

		await actor.toggleStatusEffect('dazed', { active: false });

		expect(dialog()).not.toHaveBeenCalled();
		expect(coreToggle()).toHaveBeenCalledWith('dazed', { active: false });
	});
});
