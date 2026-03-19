const FEET_PER_SPACE = 5;
const CONVERSION_DECIMAL_PRECISION = 3;

type AmbientLightLike = {
	config?: {
		dim?: number;
		bright?: number;
	};
	updateSource: (changes: Record<string, unknown>) => void;
};

type TokenLike = {
	light?: {
		dim?: number;
		bright?: number;
	};
	sight?: {
		range?: number | null;
	};
	updateSource: (changes: Record<string, unknown>) => void;
};

type AmbientSoundLike = {
	radius?: number;
	updateSource: (changes: Record<string, unknown>) => void;
};

function normalizeGridUnit(unit: string | undefined): string {
	return (unit ?? '').trim().toLowerCase();
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

function convertAmbientLightRange(light: AmbientLightLike): void {
	const dim = light.config?.dim;
	const bright = light.config?.bright;
	if (typeof dim !== 'number' || typeof bright !== 'number') return;

	const convertedDim = convertFeetToSpacesDistance(dim);
	const convertedBright = convertFeetToSpacesDistance(bright);
	if (convertedDim === dim && convertedBright === bright) return;

	light.updateSource({
		'config.dim': convertedDim,
		'config.bright': convertedBright,
	});
}

function convertTokenLightRange(token: TokenLike): void {
	const dim = token.light?.dim;
	const bright = token.light?.bright;
	const sightRange = token.sight?.range;
	const hasLightRange = typeof dim === 'number' && typeof bright === 'number';
	const hasVisionRange = typeof sightRange === 'number';
	if (!hasLightRange && !hasVisionRange) return;

	const tokenUpdate: Record<string, unknown> = {};

	if (hasLightRange) {
		const convertedDim = convertFeetToSpacesDistance(dim);
		const convertedBright = convertFeetToSpacesDistance(bright);
		if (convertedDim !== dim || convertedBright !== bright) {
			tokenUpdate['light.dim'] = convertedDim;
			tokenUpdate['light.bright'] = convertedBright;
		}
	}

	if (hasVisionRange) {
		const convertedSightRange = convertFeetToSpacesDistance(sightRange);
		if (convertedSightRange !== sightRange) {
			tokenUpdate['sight.range'] = convertedSightRange;
		}
	}

	if (Object.keys(tokenUpdate).length < 1) return;
	token.updateSource(tokenUpdate);
}

function convertAmbientSoundRadius(sound: AmbientSoundLike): void {
	const radius = sound.radius;
	if (typeof radius !== 'number') return;

	const convertedRadius = convertFeetToSpacesDistance(radius);
	if (convertedRadius === radius) return;

	sound.updateSource({
		radius: convertedRadius,
	});
}

function shouldConvertSceneFromFeetToSpaces(scene: Scene.Implementation): boolean {
	if (!isFeetUnit(scene.grid?.units)) return false;
	return isMultipleOfFive(scene.grid?.distance);
}

export class NimbleScene extends Scene {
	protected override async _preCreate(
		data: Scene.CreateData,
		options: Scene.Database.PreCreateOptions,
		user: User.Implementation,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		if (!shouldConvertSceneFromFeetToSpaces(this as Scene.Implementation)) {
			return super._preCreate(data, options, user);
		}

		const convertedGridDistance = convertFeetToSpacesDistance(this.grid.distance);
		this.updateSource(
			{
				'grid.distance': convertedGridDistance,
				'grid.units': 'spaces',
			} as Record<string, unknown>,
			{} as Record<string, unknown>,
		);

		for (const light of this.lights.contents as unknown as AmbientLightLike[]) {
			convertAmbientLightRange(light);
		}

		for (const token of this.tokens.contents as unknown as TokenLike[]) {
			convertTokenLightRange(token);
		}

		for (const sound of this.sounds.contents as unknown as AmbientSoundLike[]) {
			convertAmbientSoundRadius(sound);
		}

		return super._preCreate(data, options, user);
	}
}
