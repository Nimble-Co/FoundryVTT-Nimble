export type ActorResourceData = {
	system?: {
		attributes?: {
			hp?: {
				value?: number;
				max?: number;
				lastStandThreshold?: number;
			};
			wounds?: {
				value?: number;
				max?: number;
			};
		};
		resources?: {
			mana?: {
				current?: number;
				value?: number;
				baseMax?: number;
				max?: number;
			};
		};
	};
};

export type ActorHpData = ActorResourceData;
