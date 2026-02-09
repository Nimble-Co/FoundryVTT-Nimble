import { vi } from 'vitest';

/**
 * Mocks for FoundryVTT global objects and APIs
 * These replace the actual FoundryVTT functionality with test-friendly implementations
 */

// Global Foundry classes that must be set up before any code tries to extend them
// UI notifications mock
export const uiMock = {
	notifications: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
};

export const globalFoundryMocks = {
	Actor: class Actor {
		constructor(data?: any, _context?: any) {
			if (data) Object.assign(this, data);
		}
	},
	Item: class Item {
		constructor(data?: any, _context?: any) {
			if (data) Object.assign(this, data);
		}
	},
	Combat: class Combat {
		constructor(data?: any, _context?: any) {
			if (data) Object.assign(this, data);
		}
	},
	Combatant: class Combatant {
		constructor(data?: any, _context?: any) {
			if (data) Object.assign(this, data);
		}
	},
	ChatMessage: class ChatMessage {
		constructor(data?: any, _context?: any) {
			if (data) Object.assign(this, data);
		}
	},
	TokenDocument: class TokenDocument {
		constructor(data?: any, _context?: any) {
			if (data) Object.assign(this, data);
		}
	},
	ActiveEffect: class ActiveEffect {
		constructor(data?: any, _context?: any) {
			if (data) Object.assign(this, data);
		}
	},
	ROLL: class Roll {
		formula: string;
		data: any;
		options: any;

		constructor(formula: string, data?: any, options?: any) {
			this.formula = formula;
			this.data = data ?? {};
			this.options = options ?? {};
		}

		async evaluate() {
			return this;
		}
	},
	Hooks: {
		on: vi.fn(() => ({ id: Math.random().toString(36) })),
		off: vi.fn(),
		once: vi.fn(() => ({ id: Math.random().toString(36) })),
		callAll: vi.fn(),
		call: vi.fn(),
	},
	CONST: {
		TOKEN_DISPOSITIONS: {
			SECRET: -2,
			HOSTILE: -1,
			NEUTRAL: 0,
			FRIENDLY: 1,
		},
		DOCUMENT_OWNERSHIP_LEVELS: {
			NONE: 0,
			LIMITED: 1,
			OBSERVER: 2,
			OWNER: 3,
		},
	},
	localize: (key: string) => key,
};

/**
 * Creates a trackable Roll mock that can be used with vi.fn() to track constructor calls
 * This is useful for tests that need to verify Roll constructor invocations
 * @returns An object with the mock function and the constructor function for resetting
 */
export function createTrackableRollMock() {
	// Use a proper class that can be extended by DamageRoll etc.
	class MockRollClass {
		formula: string;
		data?: unknown;
		options: Record<string, unknown>;
		terms: unknown[];
		_evaluated?: boolean;
		_total?: number;
		_formula?: string;

		constructor(formula: string, data?: unknown, options?: Record<string, unknown>) {
			this.formula = formula;
			this.data = data ?? {};
			this.options = options ?? {};
			this.terms = [];
			this._formula = formula;
		}

		toJSON() {
			return { total: this._total ?? 0, formula: this.formula };
		}

		resetFormula() {
			this._formula = MockRollClass.getFormula(this.terms);
		}

		static getFormula(terms: unknown[]): string {
			// Simple implementation that reconstructs formula from terms
			if (!terms || terms.length === 0) return '';
			return terms
				.map((term) => {
					const t = term as Record<string, unknown>;
					if (t.operator) return t.operator;
					if (t.number && t.faces) return `${t.number}d${t.faces}`;
					if (t.number !== undefined) return String(t.number);
					return '';
				})
				.filter(Boolean)
				.join('');
		}

		static fromData(data: Record<string, unknown>) {
			const roll = new MockRollClass(
				data.formula as string,
				data.data as unknown,
				data.options as Record<string, unknown>,
			);
			if (data.terms) roll.terms = data.terms as unknown[];
			// Preserve other properties that might be in the data object
			if (data._evaluated !== undefined) roll._evaluated = data._evaluated as boolean;
			if (data._total !== undefined) roll._total = data._total as number;
			if (data.total !== undefined) roll._total = data.total as number;
			return roll;
		}

		static validate(_formula: string): boolean {
			// Always return true for mock - real validation not needed in tests
			return true;
		}

		async evaluate() {
			this._evaluated = true;
			this._total ??= 0;
			return this;
		}

		evaluateSync(_options?: { strict?: boolean }) {
			this._evaluated = true;
			// Parse simple numeric formulas
			const formula = this.formula.trim();
			const data = this.data as Record<string, unknown>;

			// Handle @-references by replacing them with values from rollData
			let resolvedFormula = formula.replace(/@([\w.]+)/g, (_match, path: string) => {
				const value = path.split('.').reduce((obj: unknown, key: string) => {
					if (obj && typeof obj === 'object') {
						return (obj as Record<string, unknown>)[key];
					}
					return undefined;
				}, data);
				return value !== undefined ? String(value) : '0';
			});

			// Evaluate the formula (simple arithmetic)
			try {
				// Use Function to safely evaluate arithmetic expressions
				// eslint-disable-next-line @typescript-eslint/no-implied-eval
				this._total = new Function(`return (${resolvedFormula})`)() as number;
			} catch {
				this._total = 0;
			}

			return this;
		}

		get total(): number | undefined {
			return this._total;
		}
	}

	// Store reference to the original class and a custom implementation
	let customImplementation: ((...args: unknown[]) => unknown) | null = null;

	// Create a wrapper that tracks constructor calls while preserving class behavior
	const constructorSpy = vi.fn();

	// Use a proper class to wrap MockRollClass so it can be extended
	const MockRoll = class MockRoll extends MockRollClass {
		constructor(formula: string, data?: unknown, options?: Record<string, unknown>) {
			// Track the call
			constructorSpy(formula, data, options);
			// If there's a custom implementation, call it and potentially use its return value
			if (customImplementation) {
				const result = customImplementation.call(undefined, formula, data, options);
				// If the implementation returns an object, use that as the instance
				if (result && typeof result === 'object') {
					// Skip super() call by returning the custom object
					// This is a trick: we call super() but then override everything
					super(formula, data, options);
					return result as MockRoll;
				}
			}
			super(formula, data, options);
		}
	} as unknown as typeof MockRollClass & ReturnType<typeof vi.fn>;

	// Copy static methods
	MockRoll.getFormula = MockRollClass.getFormula;
	MockRoll.fromData = MockRollClass.fromData;
	MockRoll.validate = MockRollClass.validate;

	// Add vi.fn() mock methods by copying them from the spy
	// This allows tests to use mockImplementation, mockClear, etc.
	Object.defineProperty(MockRoll, 'mock', {
		get: () => constructorSpy.mock,
	});

	// Mark as a mock function so vitest recognizes it as a spy
	Object.defineProperty(MockRoll, '_isMockFunction', {
		value: true,
		writable: false,
	});

	// Copy other necessary properties from the spy for vitest compatibility
	(MockRoll as ReturnType<typeof vi.fn>).mockClear = () => {
		constructorSpy.mockClear();
		return MockRoll as ReturnType<typeof vi.fn>;
	};
	(MockRoll as ReturnType<typeof vi.fn>).mockReset = () => {
		constructorSpy.mockReset();
		customImplementation = null;
		return MockRoll as ReturnType<typeof vi.fn>;
	};
	(MockRoll as ReturnType<typeof vi.fn>).mockImplementation = (
		impl: (...args: unknown[]) => unknown,
	) => {
		customImplementation = impl;
		return MockRoll as ReturnType<typeof vi.fn>;
	};
	(MockRoll as ReturnType<typeof vi.fn>).mockName = (name: string) => {
		constructorSpy.mockName(name);
		return MockRoll as ReturnType<typeof vi.fn>;
	};
	(MockRoll as ReturnType<typeof vi.fn>).getMockName = () => {
		return constructorSpy.getMockName();
	};
	(MockRoll as ReturnType<typeof vi.fn>).mockReturnThis = () => {
		return MockRoll as ReturnType<typeof vi.fn>;
	};

	// Store reference to constructor function for backward compatibility
	function MockRollConstructor(formula: string, data?: unknown, options?: Record<string, unknown>) {
		return new MockRoll(formula, data, options);
	}

	return { MockRoll: MockRoll as unknown as ReturnType<typeof vi.fn>, MockRollConstructor };
}

// Create the trackable Roll mock for use in foundryApiMocks
const { MockRoll: trackableRollMock, MockRollConstructor: trackableRollConstructor } =
	createTrackableRollMock();

// Export the constructor so tests can reset the mock if needed
export const MockRollConstructor = trackableRollConstructor;

// Foundry API object mocks
export const foundryApiMocks = {
	dice: {
		Roll: trackableRollMock,
		terms: {
			Die: class Die {
				faces?: number;
				number?: number;
				results: any[] = [];

				constructor(termData: any) {
					Object.assign(this, termData);
				}
			},
		},
	},
	utils: {
		mergeObject: (target: any, source: any, _options?: any) => {
			const result = { ...target };
			if (source) {
				Object.assign(result, source);
			}
			return result;
		},
		deepClone: <T>(obj: T): T => {
			return JSON.parse(JSON.stringify(obj));
		},
		getProperty: (obj: any, path: string) => {
			return path.split('.').reduce((current, key) => current?.[key], obj);
		},
		setProperty: (obj: any, path: string, value: any) => {
			const keys = path.split('.');
			const lastKey = keys.pop()!;
			const target = keys.reduce((current, key) => {
				if (!current[key]) current[key] = {};
				return current[key];
			}, obj);
			target[lastKey] = value;
		},
		randomID: () => {
			return Math.random().toString(36).substring(2, 15);
		},
		invertObject: (obj: Record<string, any>) => {
			const inverted: Record<string, any> = {};
			for (const [key, value] of Object.entries(obj)) {
				inverted[value] = key;
			}
			return inverted;
		},
		flattenObject: (obj: any, prefix = '') => {
			const flattened: Record<string, any> = {};
			const flatten = (o: any, p: string) => {
				for (const [key, value] of Object.entries(o)) {
					const newKey = p ? `${p}.${key}` : key;
					if (value && typeof value === 'object' && !Array.isArray(value)) {
						flatten(value, newKey);
					} else {
						flattened[newKey] = value;
					}
				}
			};
			flatten(obj, prefix);
			return flattened;
		},
	},
	documents: {
		BaseActor: {
			ConstructorData: {},
		},
		BaseItem: {
			TypeNames: {},
		},
		BaseUser: {},
		collections: {
			Actors: {
				unregisterSheet: vi.fn(),
				registerSheet: vi.fn(),
			},
			Items: {
				unregisterSheet: vi.fn(),
				registerSheet: vi.fn(),
			},
		},
	},
	appv1: {
		sheets: {
			ActorSheet: class ActorSheet {},
			ItemSheet: class ItemSheet {},
		},
	},
	abstract: {
		TypeDataModel: class TypeDataModel {},
		DataModel: class DataModel {},
		EmbeddedCollection: class EmbeddedCollection {},
	},
	applications: {
		sheets: {
			ActorSheetV2: class ActorSheetV2 {},
			ItemSheetV2: class ItemSheetV2 {},
		},
		api: {
			ApplicationV2: class ApplicationV2 {},
			DocumentSheetV2: class DocumentSheetV2 {
				constructor(options?: any) {
					Object.assign(this, options);
				}
				async _prepareContext(_options?: any) {
					return {};
				}
				_onChangeForm(_formConfig: any, _event: Event | SubmitEvent) {}
			},
			DialogV2: {
				confirm: vi.fn(),
			},
		},
		ux: {
			TextEditor: {
				implementation: {
					enrichHTML: vi.fn((html: string) => Promise.resolve(html)),
					getDragEventData: vi.fn(),
					EnrichmentOptions: {},
				},
			},
		},
		elements: {
			HTMLProseMirrorElement: {
				create: vi.fn(),
				ProseMirrorInputConfig: {},
				tagName: 'html-prose-mirror',
			},
		},
	},
	helpers: {
		interaction: {
			TooltipManager: {
				implementation: {
					TOOLTIP_ACTIVATION_MS: 100,
				},
			},
		},
	},
	data: {
		fields: {
			StringField: class StringField {
				constructor(options?: any) {
					Object.assign(this, options);
				}
			},
			NumberField: class NumberField {
				constructor(options?: any) {
					Object.assign(this, options);
				}
			},
			BooleanField: class BooleanField {
				constructor(options?: any) {
					Object.assign(this, options);
				}
			},
			HTMLField: class HTMLField {
				constructor(options?: any) {
					Object.assign(this, options);
				}
			},
			ObjectField: class ObjectField {
				constructor(options?: any) {
					Object.assign(this, options);
				}
			},
			ArrayField: class ArrayField {
				constructor(element?: any, options?: any) {
					Object.assign(this, { element, ...options });
				}
			},
			DataField: class DataField {
				constructor(options?: any) {
					Object.assign(this, options);
				}
			},
			SchemaField: class SchemaField {
				constructor(schema?: any, options?: any) {
					Object.assign(this, { schema, ...options });
				}
			},
		},
	},
	canvas: {
		layers: {
			TemplateLayer: class TemplateLayer {},
		},
	},
};

// Game object mock factory (needs language data for i18n)
export function createGameMock(langData: any) {
	// Helper function to get nested value from object by path
	function getNestedValue(obj: any, path: string): string {
		const keys = path.split('.');
		let value = obj;
		for (const key of keys) {
			value = value?.[key];
			if (value === undefined) return path; // Return key if not found
		}
		return value;
	}

	return {
		i18n: {
			localize: (key: string) => {
				// Remove "NIMBLE." prefix if present
				const cleanKey = key.startsWith('NIMBLE.') ? key.substring(7) : key;
				// Get value from language data
				let value = getNestedValue(langData.NIMBLE, cleanKey);
				// If not found (value equals the path) and key contains "skillPointAssignments" (plural), try "skillPointAssignment" (singular)
				if (value === cleanKey && cleanKey.includes('skillPointAssignments')) {
					const singularKey = cleanKey.replace('skillPointAssignments', 'skillPointAssignment');
					const singularValue = getNestedValue(langData.NIMBLE, singularKey);
					// Only use singular value if it's different from the path (i.e., it was found)
					if (singularValue !== singularKey) {
						value = singularValue;
					}
				}
				return value || key; // Return key if not found
			},
			format: (key: string, data?: Record<string, string>) => {
				let translated = (
					globalThis as object as { game: { i18n: { localize(key: string): string } } }
				).game.i18n.localize(key);
				// Simple replacement for format strings like {remainingSkillPoints}
				if (data) {
					for (const [k, v] of Object.entries(data)) {
						translated = translated.replace(`{${k}}`, v);
					}
				}
				return translated;
			},
		},
		user: {
			id: 'test-user-id',
			name: 'Test User',
		},
		packs: {
			*[Symbol.iterator]() {
				// Empty iterator - no compendium packs in tests
			},
		},
		items: {
			*[Symbol.iterator]() {
				// Yield mock subclasses for testing
				yield {
					type: 'subclass',
					name: 'Path of the Mountainheart',
					system: {
						parentClass: 'warrior',
						identifier: 'path-of-the-mountainheart',
					},
				};
				yield {
					type: 'subclass',
					name: 'Path of the Storm',
					system: {
						parentClass: 'warrior',
						identifier: 'path-of-the-storm',
					},
				};
			},
		},
	};
}

// CONFIG initialization structure
export const configStructure = {
	Actor: {
		dataModels: {},
		trackableAttributes: {},
	},
	Combat: {},
	Combatant: {
		dataModels: {},
	},
	ChatMessage: {
		dataModels: {},
	},
	Item: {
		dataModels: {},
	},
	Token: {},
	ActiveEffect: {
		dataModels: {},
	},
	Dice: {
		rolls: [],
		types: [],
	},
	Canvas: {
		layers: {
			templates: {},
		},
	},
	TextEditor: {
		enrichers: [],
	},
};
