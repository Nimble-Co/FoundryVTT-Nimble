export interface CastSpellActionPanelProps {
	onActivateItem?: (itemId: string) => Promise<void>;
	showEmbeddedDocumentImages?: boolean;
}
