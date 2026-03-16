export interface TargetSelectorProps {
	label: string;
	noTargetMessage: string;
	multipleTargetsMessage: string;
	availableTargets: unknown[];
	selectedTarget: unknown;
	getTargetName: (target: unknown) => string;
	targetBackground: string;
	targetBorderColor: string;
}
