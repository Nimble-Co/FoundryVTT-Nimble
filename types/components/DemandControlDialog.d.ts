import type { ControlOption } from '#utils/demandControl/demandControl.js';

export interface DemandControlDialogProps {
	actor: unknown;
	dialog: { submit(choice: unknown): void; close(): void };
	locked?: ControlOption;
	reportsRound?: boolean;
}
