import { vi } from 'vitest';

/**
 * Mocks for FoundryVTT global objects and APIs
 * These replace the actual FoundryVTT functionality with test-friendly implementations
 */

// Global Foundry classes that must be set up before any code tries to extend them
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
	class MockRollClass {
		formula: string;
		data?: unknown;
		options: any;
		terms: any[];
		toJSON: ReturnType<typeof vi.fn>;
		_evaluated?: boolean;
		_total?: number;

		constructor(formula: string, data?: any, options?: any) {
			this.formula = formula;
			this.data = data ?? {};
			this.options = options ?? {};
			this.terms = [];
			this.toJSON = vi.fn().mockReturnValue({ total: 0 });
		}

		static getFormula(terms: any[]): string {
			// Simple implementation that reconstructs formula from terms
			if (!terms || terms.length === 0) return '';
			return terms
				.map((term) => {
					if (term.operator) return term.operator;
					if (term.number && term.faces) return `${term.number}d${term.faces}`;
					if (term.number !== undefined) return String(term.number);
					return '';
				})
				.filter(Boolean)
				.join('');
		}

		static fromData(data: Record<string, any>) {
			const roll = new MockRollClass(data.formula, data.data, data.options);
			if (data.terms) roll.terms = data.terms;
			// Preserve other properties that might be in the data object
			if (data._evaluated !== undefined) roll._evaluated = data._evaluated;
			if (data._total !== undefined) roll._total = data._total;
			if (data.total !== undefined) roll._total = data.total;
			return roll;
		}

		async evaluate() {
			this._evaluated = true;
			this._total ??= 0;
			return this;
		}
	}

	// Create a tracked constructor function that works with 'new'
	function MockRollConstructor(rollConstructor: any, formula: string, data?: any, options?: any) {
		const instance = new MockRollClass(formula, data, options);
		if (rollConstructor && typeof rollConstructor === 'object' && rollConstructor !== globalThis) {
			// Called with 'new' - assign to this
			Object.assign(rollConstructor, instance);
			return rollConstructor;
		}
		// Called without 'new', return new instance
		return instance;
	}

	// Make it a vi.fn() so we can track calls and override implementations
	const MockRoll = vi.fn(MockRollConstructor) as ReturnType<typeof vi.fn> & {
		prototype: typeof MockRollClass.prototype;
		getFormula: typeof MockRollClass.getFormula;
		fromData: typeof MockRollClass.fromData;
	};
	// Set up prototype so 'new' works correctly
	MockRoll.prototype = MockRollClass.prototype;
	// Add static methods
	MockRoll.getFormula = MockRollClass.getFormula;
	MockRoll.fromData = MockRollClass.fromData;
	// Make it constructable
	Object.setPrototypeOf(MockRoll, Function.prototype);

	return { MockRoll, MockRollConstructor };
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
