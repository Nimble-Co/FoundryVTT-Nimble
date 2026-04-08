export interface SubclassChoice {
	uuid: string;
	name: string;
	img: string;
	system: { parentClass: string };
}

export interface EpicBoonChoice {
	uuid: string;
	name: string;
	img: string;
	system: { boonType: string; description: string };
}
