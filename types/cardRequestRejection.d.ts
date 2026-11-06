/** Why the GM refused a card operation, as a localization key the asking client renders. */
export interface CardRequestRejection {
	messageId: string;
	/** The row or record that was refused, when there is one. */
	entryId?: string;
	userId: string;
	reasonKey: string;
}
