export type ActorResourceData = {
	system?: {
		attributes?: {
			hp?: {
				value?: number;
				max?: number;
				lastStandHp?: number;
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

export type PromptedInitiativeOptions = Combat.InitiativeOptions & {
	promptRollDialog: boolean;
};
