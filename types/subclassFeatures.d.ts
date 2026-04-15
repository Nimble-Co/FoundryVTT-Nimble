export interface SubclassFeatureIndexEntry {
	uuid: string;
}

export type SubclassFeatureIndex = Map<
	string,
	Map<string, Map<number, SubclassFeatureIndexEntry[]>>
>;

export interface FeaturePackEntry {
	uuid: string;
	type: string;
	system?: {
		class?: string;
		subclass?: boolean;
		gainedAtLevel?: number;
		gainedAtLevels?: number[];
		group?: string;
	};
}
