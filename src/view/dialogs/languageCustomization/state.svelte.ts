import {
	type CustomLanguage,
	getBuiltinLanguageBaseline,
	getLanguageCustomizations,
	type LanguageCustomizations,
	setLanguageCustomizations,
} from '../../../settings/languageSettings.js';

/** Editable row for a built-in language's overrides. */
export interface BuiltinLanguageRow {
	key: string;
	defaultLabel: string;
	defaultHint: string;
	defaultImage: string;
	label: string;
	aliases: string;
	hint: string;
	image: string;
}

/** Editable row for a GM-authored custom language. */
export interface CustomLanguageRow {
	/** Stable key once saved; empty for newly-added rows (generated on save). */
	key: string;
	label: string;
	aliases: string;
	hint: string;
	image: string;
}

const ALIAS_SEPARATOR = ', ';

function parseAliases(text: string): string[] {
	return text
		.split(',')
		.map((alias) => alias.trim())
		.filter((alias) => alias.length > 0);
}

function formatAliases(aliases: string[] | undefined): string {
	return (aliases ?? []).join(ALIAS_SEPARATOR);
}

/** Slug-derive a stable, unique language key from a label. */
function generateLanguageKey(label: string, taken: Set<string>): string {
	const slug = label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(' ')
		.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
		.join('');

	const base = slug.length > 0 ? slug : 'language';
	let candidate = base;
	let suffix = 2;
	while (taken.has(candidate)) {
		candidate = `${base}${suffix}`;
		suffix += 1;
	}
	return candidate;
}

export class LanguageCustomizationDialogState {
	builtinRows = $state<BuiltinLanguageRow[]>([]);

	customRows = $state<CustomLanguageRow[]>([]);

	saving = $state(false);

	constructor() {
		const baseline = getBuiltinLanguageBaseline();
		const { overrides, custom } = getLanguageCustomizations();

		this.builtinRows = Object.entries(baseline.languages).map(([key, defaultLabel]) => {
			const override = overrides[key] ?? {};
			return {
				key,
				defaultLabel,
				defaultHint: baseline.languageHints[key] ?? '',
				defaultImage: baseline.languageImages[key] ?? '',
				label: override.label ?? '',
				aliases: formatAliases(override.aliases),
				hint: override.hint ?? '',
				image: override.image ?? '',
			};
		});

		this.customRows = custom.map((language) => ({
			key: language.key,
			label: language.label,
			aliases: formatAliases(language.aliases),
			hint: language.hint ?? '',
			image: language.image ?? '',
		}));
	}

	addCustomLanguage = (): void => {
		this.customRows = [
			...this.customRows,
			{ key: '', label: '', aliases: '', hint: '', image: '' },
		];
	};

	removeCustomLanguage = (index: number): void => {
		this.customRows = this.customRows.filter((_, i) => i !== index);
	};

	resetBuiltin = (index: number): void => {
		this.builtinRows = this.builtinRows.map((row, i) =>
			i === index ? { ...row, label: '', aliases: '', hint: '', image: '' } : row,
		);
	};

	save = async (): Promise<void> => {
		this.saving = true;

		try {
			const overrides: LanguageCustomizations['overrides'] = {};
			for (const row of this.builtinRows) {
				const override: LanguageCustomizations['overrides'][string] = {};
				const label = row.label.trim();
				const hint = row.hint.trim();
				const image = row.image.trim();
				const aliases = parseAliases(row.aliases);

				if (label && label !== row.defaultLabel) override.label = label;
				if (hint && hint !== row.defaultHint) override.hint = hint;
				if (image && image !== row.defaultImage) override.image = image;
				if (aliases.length) override.aliases = aliases;

				if (Object.keys(override).length > 0) overrides[row.key] = override;
			}

			const taken = new Set<string>(this.builtinRows.map((row) => row.key));
			const custom: CustomLanguage[] = [];
			for (const row of this.customRows) {
				const label = row.label.trim();
				if (!label) continue;

				const key = row.key || generateLanguageKey(label, taken);
				taken.add(key);

				custom.push({
					key,
					label,
					aliases: parseAliases(row.aliases),
					hint: row.hint.trim(),
					image: row.image.trim(),
				});
			}

			await setLanguageCustomizations({ overrides, custom });
		} finally {
			this.saving = false;
		}
	};
}
