export type AmbientLightLike = {
	config?: {
		dim?: number;
		bright?: number;
	};
	updateSource: (changes: Record<string, unknown>) => void;
};

export type TokenLike = {
	light?: {
		dim?: number;
		bright?: number;
	};
	sight?: {
		range?: number | null;
	};
	updateSource: (changes: Record<string, unknown>) => void;
};

export type AmbientSoundLike = {
	radius?: number;
	updateSource: (changes: Record<string, unknown>) => void;
};

export type SceneGridLike = {
	grid?: {
		units?: string;
		distance?: number;
	};
};
