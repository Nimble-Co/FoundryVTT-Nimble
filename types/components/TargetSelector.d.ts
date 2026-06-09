type TargetToken = Token | null | undefined;

export interface TargetSelectorProps {
	label: string;
	noTargetMessage: string;
	multipleTargetsMessage: string;
	availableTargets: TargetToken[];
	selectedTarget: TargetToken;
	getTargetName: (target: TargetToken) => string;
	targetBackground: string;
	targetBorderColor: string;
}
