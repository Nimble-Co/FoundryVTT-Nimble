export interface FreeAssessDialogProps {
	dialog: { submit(choice: unknown): void; close(): void };
	roundUsed: boolean;
	spendLine: string;
}
