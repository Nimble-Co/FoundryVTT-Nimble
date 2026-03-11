export interface AttackActionPanelProps {
	onActivateItem?: (itemId: string) => Promise<void>;
	showEmbeddedDocumentImages?: boolean;
}
