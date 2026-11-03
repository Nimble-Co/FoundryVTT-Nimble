import type { ControlOption } from '#types/optionWindow.d.ts';
import type { optionRows } from '#utils/demandControl/demandControl.js';

export interface DemandControlDialogProps {
	actor: Parameters<typeof optionRows>[0];
	dialog: { submitActivation(choice: unknown): void; close(): void };
	locked?: ControlOption;
	reportsRound?: boolean;
}
