import { beforeEach, describe, expect, it, vi } from 'vitest';
import updateDocumentImage from './updateDocumentImage.js';

type FilePickerOptions = {
	type: string;
	current?: string;
	callback: (path: string) => Promise<void>;
};

type GameImageTestDoubles = {
	modules: {
		get: ReturnType<typeof vi.fn>;
	};
};

type FilePickerConstructor = new (
	options: FilePickerOptions,
) => {
	browse: () => Promise<unknown>;
};

type FoundryApplicationsWithFilePicker = {
	apps?: {
		FilePicker?: {
			implementation?: FilePickerConstructor;
		};
	};
};

describe('updateDocumentImage', () => {
	beforeEach(() => {
		(game as unknown as GameImageTestDoubles).modules = {
			get: vi.fn().mockReturnValue(undefined),
		};
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
			constructor(options: FilePickerOptions) {
				capturedOptions = options;
			}

			browse(): Promise<unknown> {
				return browse();
			}
		}

		(foundry.applications as unknown as FoundryApplicationsWithFilePicker).apps = {
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
