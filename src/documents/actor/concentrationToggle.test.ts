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

const dialogApi = foundry.applications.api.DialogV2 as { wait?: unknown };
const dialog = () => dialogApi.wait as ReturnType<typeof vi.fn>;

const coreActor = Object.getPrototypeOf(NimbleBaseActor.prototype) as {
	toggleStatusEffect?: unknown;
};
const coreToggle = () => coreActor.toggleStatusEffect as ReturnType<typeof vi.fn>;

beforeEach(() => {
	dialogApi.wait = vi.fn();
	coreActor.toggleStatusEffect = vi.fn(async () => undefined);
});

afterEach(() => {
	dialogApi.wait = undefined;
	coreActor.toggleStatusEffect = undefined;
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

	it('leaves both in place when the choice is dismissed, reporting still active', async () => {
		const actor = createConcentratingActor([
			createHeldConcentration('lightning'),
			createHeldConcentration('wind'),
		]);
		dialog().mockResolvedValue(null);

		expect(await actor.toggleStatusEffect('concentration', { active: false })).toBe(true);
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(coreToggle()).not.toHaveBeenCalled();
	});

	it('reports the status still active when one of two tracks ends', async () => {
		const lightning = createHeldConcentration('lightning');
		const wind = createHeldConcentration('wind');
		const actor = createConcentratingActor([lightning, wind]);
		dialog().mockResolvedValue(wind.id);

		expect(await actor.toggleStatusEffect('concentration')).toBe(true);
	});

	it('reports the status gone when every track ends', async () => {
		const lightning = createHeldConcentration('lightning');
		const wind = createHeldConcentration('wind');
		const actor = createConcentratingActor([lightning, wind]);
		dialog().mockResolvedValue('all');

		expect(await actor.toggleStatusEffect('concentration')).toBe(false);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			lightning.id,
			wind.id,
		]);
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
