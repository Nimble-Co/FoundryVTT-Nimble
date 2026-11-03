export interface FreeAssessDialogProps {
	dialog: { submitActivation(choice: unknown): void; close(): void };
	roundUsed: boolean;
	spendLine: string;
}
