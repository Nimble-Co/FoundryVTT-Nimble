import localize from '../utils/localize.js';

const CONVERT_FEET_TO_SPACES_ACTION_LOCALIZATION_KEY =
	'NIMBLE.sceneDirectoryContext.convertFeetToSpaces';
const CONVERT_FEET_TO_SPACES_ICON_CLASS = 'fa-solid fa-ruler-combined';
const CONVERT_FEET_TO_SPACES_GROUP_ID = 'nimble-scene-directory-convert-feet-to-spaces';
const SCENE_DOCUMENT_CONTEXT_OPTIONS_HOOK = 'getSceneContextOptions';
const FEET_PER_SPACE = 5;
const CONVERSION_DECIMAL_PRECISION = 3;
const CONVERT_FEET_TO_SPACES_FAILED_LOCALIZATION_KEY =
	'NIMBLE.sceneDirectoryContext.convertFeetToSpacesFailed';

let didRegisterSceneDirectoryConvertFeetToSpacesContextMenu = false;

type DirectoryTarget = HTMLElement | JQuery;
type SceneCollectionOwner = {
	collection?: {
		get: (id: string) => Scene.Implementation | null | undefined;
	};
};

function isObjectWithNumericKeyZero(value: unknown): value is { 0: unknown } {
	return typeof value === 'object' && value !== null && 0 in value;
}

function toHtmlElement(target: DirectoryTarget): HTMLElement | null {
	if (target instanceof HTMLElement) return target;
	if (!isObjectWithNumericKeyZero(target)) return null;
	return target[0] instanceof HTMLElement ? target[0] : null;
}

function getDirectoryEntryElement(target: DirectoryTarget): HTMLElement | null {
	const element = toHtmlElement(target);
	if (!element) return null;

	const directoryEntry = element.closest<HTMLElement>('.directory-item[data-entry-id]');
	return directoryEntry ?? element;
}

function resolveSceneFromTarget(
	target: DirectoryTarget,
	app: SceneCollectionOwner | null,
): Scene.Implementation | null {
	const entryElement = getDirectoryEntryElement(target);
	const sceneId = entryElement?.dataset.entryId ?? '';
	if (!sceneId) return null;
	return app?.collection?.get(sceneId) ?? game.scenes?.get(sceneId) ?? null;
}

function normalizeGridUnit(unit: string | undefined): string {
	return (unit ?? '').trim().toLowerCase();
}

function isSpacesUnit(unit: string | undefined): boolean {
	return normalizeGridUnit(unit) === 'spaces';
}

function isFeetUnit(unit: string | undefined): boolean {
	const normalizedUnit = normalizeGridUnit(unit);
	return normalizedUnit === 'ft' || normalizedUnit === 'feet';
}

function isMultipleOfFive(value: number | undefined): boolean {
	return typeof value === 'number' && Number.isFinite(value) && value % 5 === 0;
}

function convertFeetToSpacesDistance(value: number): number {
	const converted = value / FEET_PER_SPACE;
	return Number.parseFloat(converted.toFixed(CONVERSION_DECIMAL_PRECISION));
}

function buildAmbientLightUpdates(scene: Scene.Implementation): Record<string, unknown>[] {
	const updates: Record<string, unknown>[] = [];

	for (const light of scene.lights.contents) {
		const lightId = light.id ?? '';
		if (!lightId) continue;

		const dim = light.config?.dim;
		const bright = light.config?.bright;
		if (typeof dim !== 'number' || typeof bright !== 'number') continue;

		const convertedDim = convertFeetToSpacesDistance(dim);
		const convertedBright = convertFeetToSpacesDistance(bright);
		if (convertedDim === dim && convertedBright === bright) continue;

		updates.push({
			_id: lightId,
			'config.dim': convertedDim,
			'config.bright': convertedBright,
		});
	}

	return updates;
}

function buildAmbientLightRollbackUpdates(
	scene: Scene.Implementation,
	updates: Record<string, unknown>[],
): Record<string, unknown>[] {
	const rollbackUpdates: Record<string, unknown>[] = [];

	for (const update of updates) {
		const lightId = typeof update._id === 'string' ? update._id : '';
		if (!lightId) continue;

		const light = scene.lights.get(lightId);
		if (!light) continue;

		rollbackUpdates.push({
			_id: lightId,
			'config.dim': light.config.dim,
			'config.bright': light.config.bright,
		});
	}

	return rollbackUpdates;
}

function buildTokenLightUpdates(scene: Scene.Implementation): Record<string, unknown>[] {
	const updates: Record<string, unknown>[] = [];

	for (const token of scene.tokens.contents) {
		const tokenId = token.id ?? '';
		if (!tokenId) continue;

		const dim = token.light?.dim;
		const bright = token.light?.bright;
		if (typeof dim !== 'number' || typeof bright !== 'number') continue;

		const convertedDim = convertFeetToSpacesDistance(dim);
		const convertedBright = convertFeetToSpacesDistance(bright);
		if (convertedDim === dim && convertedBright === bright) continue;

		updates.push({
			_id: tokenId,
			'light.dim': convertedDim,
			'light.bright': convertedBright,
		});
	}

	return updates;
}

function buildTokenLightRollbackUpdates(
	scene: Scene.Implementation,
	updates: Record<string, unknown>[],
): Record<string, unknown>[] {
	const rollbackUpdates: Record<string, unknown>[] = [];

	for (const update of updates) {
		const tokenId = typeof update._id === 'string' ? update._id : '';
		if (!tokenId) continue;

		const token = scene.tokens.get(tokenId);
		if (!token) continue;

		rollbackUpdates.push({
			_id: tokenId,
			'light.dim': token.light.dim,
			'light.bright': token.light.bright,
		});
	}

	return rollbackUpdates;
}

async function convertSceneFromFeetToSpaces(scene: Scene.Implementation): Promise<void> {
	if (!isConvertFeetToSpacesActionEnabled(scene)) return;

	const rollbackGridUpdate = {
		'grid.distance': scene.grid.distance,
		'grid.units': scene.grid.units,
	} as Record<string, unknown>;

	const convertedGridDistance = convertFeetToSpacesDistance(scene.grid.distance);
	const ambientLightUpdates = buildAmbientLightUpdates(scene);
	const ambientLightRollbackUpdates = buildAmbientLightRollbackUpdates(scene, ambientLightUpdates);
	const tokenLightUpdates = buildTokenLightUpdates(scene);
	const tokenLightRollbackUpdates = buildTokenLightRollbackUpdates(scene, tokenLightUpdates);

	let didUpdateScene = false;
	let didUpdateAmbientLights = false;
	let didUpdateTokens = false;

	try {
		await scene.update({
			'grid.distance': convertedGridDistance,
			'grid.units': 'spaces',
		} as Record<string, unknown>);
		didUpdateScene = true;

		if (ambientLightUpdates.length > 0) {
			await scene.updateEmbeddedDocuments('AmbientLight', ambientLightUpdates);
			didUpdateAmbientLights = true;
		}

		if (tokenLightUpdates.length > 0) {
			await scene.updateEmbeddedDocuments('Token', tokenLightUpdates);
			didUpdateTokens = true;
		}
	} catch (error) {
		if (didUpdateTokens && tokenLightRollbackUpdates.length > 0) {
			await scene
				.updateEmbeddedDocuments('Token', tokenLightRollbackUpdates)
				.catch(() => undefined);
		}

		if (didUpdateAmbientLights && ambientLightRollbackUpdates.length > 0) {
			await scene
				.updateEmbeddedDocuments('AmbientLight', ambientLightRollbackUpdates)
				.catch(() => undefined);
		}

		if (didUpdateScene) {
			await scene.update(rollbackGridUpdate).catch(() => undefined);
		}

		throw error;
	}
}

function shouldHideConvertFeetToSpacesAction(scene: Scene.Implementation | null): boolean {
	if (!scene) return false;
	return isSpacesUnit(scene?.grid.units);
}

function isConvertFeetToSpacesActionEnabled(scene: Scene.Implementation | null): boolean {
	if (!scene) return false;
	if (!isFeetUnit(scene.grid.units)) return false;
	return isMultipleOfFive(scene.grid.distance);
}

function shouldShowDisabledConvertFeetToSpacesAction(scene: Scene.Implementation | null): boolean {
	if (shouldHideConvertFeetToSpacesAction(scene)) return false;
	return !isConvertFeetToSpacesActionEnabled(scene);
}

function hasConvertFeetToSpacesMenuOption(
	entryOptions: ContextMenu.Entry<HTMLElement | JQuery>[],
): boolean {
	return entryOptions.some((entry) => entry.group === CONVERT_FEET_TO_SPACES_GROUP_ID);
}

export default function registerSceneDirectoryConvertFeetToSpacesContextMenu(): void {
	if (didRegisterSceneDirectoryConvertFeetToSpacesContextMenu) return;
	didRegisterSceneDirectoryConvertFeetToSpacesContextMenu = true;

	const registerSceneDirectoryEntryContext = (
		app: Application,
		entryOptions: ContextMenu.Entry<HTMLElement | JQuery>[],
	): void => {
		if (hasConvertFeetToSpacesMenuOption(entryOptions)) return;

		const sceneDirectoryApp = app as unknown as SceneCollectionOwner;
		const localizedName = localize(CONVERT_FEET_TO_SPACES_ACTION_LOCALIZATION_KEY);

		entryOptions.push({
			name: localizedName,
			icon: `<i class="${CONVERT_FEET_TO_SPACES_ICON_CLASS}"></i>`,
			group: CONVERT_FEET_TO_SPACES_GROUP_ID,
			condition: (target) => {
				const scene = resolveSceneFromTarget(target, sceneDirectoryApp);
				if (shouldHideConvertFeetToSpacesAction(scene)) return false;
				return isConvertFeetToSpacesActionEnabled(scene);
			},
			callback: (target) => {
				const scene = resolveSceneFromTarget(target, sceneDirectoryApp);
				if (!scene) return;
				void convertSceneFromFeetToSpaces(scene).catch(() => {
					ui.notifications?.error(localize(CONVERT_FEET_TO_SPACES_FAILED_LOCALIZATION_KEY));
				});
			},
		});

		entryOptions.push({
			name: `<span style="opacity:0.6;">${localizedName}</span>`,
			icon: `<i class="${CONVERT_FEET_TO_SPACES_ICON_CLASS}" style="opacity:0.6;"></i>`,
			group: CONVERT_FEET_TO_SPACES_GROUP_ID,
			condition: (target) => {
				const scene = resolveSceneFromTarget(target, sceneDirectoryApp);
				return shouldShowDisabledConvertFeetToSpacesAction(scene);
			},
			callback: (_target) => {},
		});
	};

	(Hooks.on as (event: string, fn: (...args: object[]) => void) => number)(
		SCENE_DOCUMENT_CONTEXT_OPTIONS_HOOK,
		registerSceneDirectoryEntryContext as unknown as (...args: object[]) => void,
	);
}
