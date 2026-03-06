import { beforeEach, describe, expect, it, vi } from 'vitest';
import updateDocumentImage from './updateDocumentImage.js';

describe('updateDocumentImage', () => {
	beforeEach(() => {
		(game as typeof game & { modules: Map<string, { active: boolean }> }).modules = new Map();
	});

	it('uses the namespaced FilePicker implementation when available', async () => {
		const browse = vi.fn().mockResolvedValue('browsed');
		let capturedOptions:
			| {
					type: string;
					current?: string;
					callback: (path: string) => Promise<void>;
			  }
			| undefined;

		class FilePickerImplementation {
			constructor(options: {
				type: string;
				current?: string;
				callback: (path: string) => Promise<void>;
			}) {
				capturedOptions = options;
			}

			browse() {
				return browse();
			}
		}

		(
			foundry.applications as typeof foundry.applications & {
				apps?: {
					FilePicker?: {
						implementation?: typeof FilePickerImplementation;
					};
				};
			}
		).apps = {
			FilePicker: {
				implementation: FilePickerImplementation,
			},
		};

		const document = {
			type: 'npc',
			img: 'systems/nimble/assets/old.png',
			update: vi.fn().mockResolvedValue(undefined),
		} as unknown as Actor;

		await updateDocumentImage(document);
		await capturedOptions?.callback('systems/nimble/assets/new.png');

		expect(browse).toHaveBeenCalledTimes(1);
		expect(capturedOptions).toMatchObject({
			type: 'image',
			current: 'systems/nimble/assets/old.png',
		});
		expect(document.update).toHaveBeenCalledWith({
			img: 'systems/nimble/assets/new.png',
		});
	});
});
