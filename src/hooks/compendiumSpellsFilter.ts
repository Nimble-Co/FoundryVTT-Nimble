/**
 * Spell School Icon Filter for Nimble Spells Compendium
 * Adds clickable icon buttons to filter spells by school and sorts by tier with group headers
 */

const GLOBAL_NIMBLE_SPELLS_COLLECTION = 'nimble.nimble-spells';
let activeSchoolFilter = '';
let isApplyingFilter = false;
let cachedSpellDataById: Map<string, { school: string; tier: number }> | null = null;
let cachedSpellNameById: Map<string, string> | null = null;

const SCHOOL_KEYS = [
	'fire',
	'ice',
	'lightning',
	'necrotic',
	'radiant',
	'wind',
	'secret',
	'utility',
];
function ensureSchoolFilterStyles(): void {
	if (document.getElementById('nimble-spell-school-filter-styles')) {
		return;
	}

	const style = document.createElement('style');
	style.id = 'nimble-spell-school-filter-styles';
	style.textContent = SCHOOL_KEYS.map(
		(school) => `
.nimble-school-filter-${school} li[data-document-id]:not([data-nimble-school="${school}"]),
.nimble-school-filter-${school} li[data-entry-id]:not([data-nimble-school="${school}"]),
.nimble-school-filter-${school} .compendium-entry:not([data-nimble-school="${school}"]),
.nimble-school-filter-${school} .compendium-item:not([data-nimble-school="${school}"]),
.nimble-school-filter-${school} .directory-item:not([data-nimble-school="${school}"]) {
	display: none !important;
}
.nimble-school-filter-${school} li[data-document-id]:not([data-nimble-school]),
.nimble-school-filter-${school} li[data-entry-id]:not([data-nimble-school]),
.nimble-school-filter-${school} .compendium-entry:not([data-nimble-school]),
.nimble-school-filter-${school} .compendium-item:not([data-nimble-school]),
.nimble-school-filter-${school} .directory-item:not([data-nimble-school]) {
	display: none !important;
}
`,
	).join('');
	document.head.appendChild(style);
}

function ensureClearFiltersStyles(): void {
	if (document.getElementById('nimble-clear-filters-styles')) {
		return;
	}

	const style = document.createElement('style');
	style.id = 'nimble-clear-filters-styles';
	style.textContent = `
.nimble-clear-filters::before,
.nimble-clear-filters::after {
	content: none !important;
}
.nimble-clear-filters {
	background-image: none !important;
}
`;
	document.head.appendChild(style);
}

function applySchoolFilterClass(compendiumElement: HTMLElement | null, school: string): void {
	if (!compendiumElement) return;
	for (const key of SCHOOL_KEYS) {
		compendiumElement.classList.remove(`nimble-school-filter-${key}`);
	}
	if (school) {
		compendiumElement.classList.add(`nimble-school-filter-${school}`);
	}
}

function applyCachedMetadataToListItems(
	compendiumElement: HTMLElement | null,
	spellData: Map<string, { school: string; tier: number }> | null,
): void {
	if (!compendiumElement || !spellData) return;
	const listItems: NodeListOf<HTMLElement> = compendiumElement.querySelectorAll(
		'li[data-document-id], li[data-entry-id], .compendium-entry, .compendium-item, .directory-item',
	);
	listItems.forEach((item: HTMLElement) => {
		const itemId =
			item.getAttribute('data-document-id') ||
			item.getAttribute('data-entry-id') ||
			item.getAttribute('data-id') ||
			'';
		if (itemId) {
			const data = spellData.get(itemId);
			if (data) {
				item.setAttribute('data-nimble-school', data.school || '');
				if (data.school) {
					addSchoolIconToItem(item, data.school);
				}
				addTierBadgeToItem(item, data.tier);
			}
		}
	});
}

function applySearchFilter(
	compendiumElement: HTMLElement | null,
	searchTerm: string,
	nameById: Map<string, string> | null,
): void {
	if (!compendiumElement) return;
	const term = searchTerm.trim().toLowerCase();
	if (!term) return;

	const listItems: NodeListOf<HTMLElement> = compendiumElement.querySelectorAll(
		'li[data-document-id], li[data-entry-id], .compendium-entry, .compendium-item, .directory-item',
	);
	listItems.forEach((item: HTMLElement) => {
		const itemId =
			item.getAttribute('data-document-id') ||
			item.getAttribute('data-entry-id') ||
			item.getAttribute('data-id') ||
			'';
		if (itemId) {
			let name = nameById?.get(itemId) || '';
			if (!name) {
				const nameLink = item.querySelector('a') || item;
				name = (nameLink?.textContent || '').toLowerCase();
			}
			if (name.includes(term)) {
				item.style.display = '';
			} else {
				item.style.display = 'none';
			}
		}
	});
}

/**
 * Map of tier values to display names
 */
const TIER_LABELS: { [key: number]: string } = {
	0: 'Utility',
	1: 'Cantrip',
	2: 'Tier 1',
	3: 'Tier 2',
	4: 'Tier 3',
	5: 'Tier 4',
	6: 'Tier 5',
	7: 'Tier 6',
	8: 'Tier 7',
	9: 'Tier 8',
	10: 'Tier 9',
};

/**
 * Map of school values to Font Awesome icon classes
 */
const SCHOOL_ICONS: { [key: string]: string } = {
	fire: 'fa-solid fa-fire',
	ice: 'fa-solid fa-snowflake',
	lightning: 'fa-solid fa-bolt',
	necrotic: 'fa-solid fa-skull',
	radiant: 'fa-solid fa-sun',
	wind: 'fa-solid fa-wind',
	secret: 'fa-solid fa-eye-slash',
	utility: 'fa-solid fa-wand-magic-sparkles',
};

/**
 * Tier header colors when a specific school filter is active
 */
const SCHOOL_TIER_COLORS: { [key: string]: string } = {
	fire: '#FF8C00', // orange
	ice: '#FFFFFF', // white
	lightning: '#1E90FF', // blue
	necrotic: '#b000b0', // purple
	radiant: '#FFD700', // yellow
	wind: '#FFFFFF', // white
};
/**
 * Normalize index entries to handle various pack.index formats
 * Handles array-based entries, object-based entries, and alternate field paths
 */
function normalizeIndexEntry(e: any): {
	_id: string;
	system: { school: string; tier: number; propertiesSelected?: string[] };
} {
	// Handle array-based entries where _id is at index 0 and payload at indices 1-2
	if (Array.isArray(e)) {
		const [_id, field1, field2] = e;
		const payload = field2 || field1 || {};
		const propertiesSelected = payload.system?.properties?.selected || payload.properties?.selected;
		const tierValue = payload.system?.tier ?? payload.tier ?? 0;
		const tier =
			Array.isArray(propertiesSelected) && propertiesSelected.includes('utilitySpell')
				? 0
				: tierValue;
		return {
			_id,
			system: {
				school: payload.system?.school || payload.school || '',
				tier,
				propertiesSelected,
			},
		};
	}

	// Handle object-based entries
	if (typeof e === 'object' && e !== null) {
		const propertiesSelected = e.system?.properties?.selected || e.properties?.selected;
		const tierValue = e.system?.tier ?? e.tier ?? 0;
		const tier =
			Array.isArray(propertiesSelected) && propertiesSelected.includes('utilitySpell')
				? 0
				: tierValue;
		// Direct system.school and system.tier fields
		if (e.system?.school !== undefined) {
			return {
				_id: e._id,
				system: {
					school: e.system.school,
					tier,
					propertiesSelected,
				},
			};
		}

		// Alternate field paths
		if (e.school) {
			return {
				_id: e._id,
				system: {
					school: e.school,
					tier,
					propertiesSelected,
				},
			};
		}

		// Default case
		return {
			_id: e._id,
			system: {
				school: e.system?.school || '',
				tier,
				propertiesSelected,
			},
		};
	}

	return {
		_id: '',
		system: { school: '', tier: 0 },
	};
}

/**
 * Add school icon to a spell item's display name
 */
function ensureSpellNameLayout(nameLink: HTMLElement): void {
	if (nameLink.classList.contains('nimble-spell-name-flex')) {
		return;
	}

	nameLink.classList.add('nimble-spell-name-flex');
	nameLink.style.display = 'flex';
	nameLink.style.alignItems = 'center';
	nameLink.style.width = '100%';
}

function addSchoolIconToItem(item: HTMLElement, school: string): void {
	try {
		// Find the spell name element (usually the first text node or a link)
		const nameLink = item.querySelector('a') || item;
		if (!nameLink) return;

		ensureSpellNameLayout(nameLink as HTMLElement);

		// Check if icon already exists
		if (nameLink.querySelector('.nimble-spell-school-icon')) {
			return;
		}

		const iconClass = SCHOOL_ICONS[school];
		if (!iconClass) return;

		// Create and append icon element
		const iconSpan = document.createElement('span');
		iconSpan.className = 'nimble-spell-school-icon';
		iconSpan.style.marginLeft = '6px';
		iconSpan.style.display = 'inline-block';
		iconSpan.innerHTML = `<i class="${iconClass}" style="opacity: 0.7;"></i>`;

		nameLink.appendChild(iconSpan);
	} catch (error) {
		console.warn('Nimble: Error adding school icon to item:', error);
	}
}

/**
 * Add tier badge (single letter/number) to a spell item's display name
 */
function addTierBadgeToItem(item: HTMLElement, tier: number): void {
	try {
		const nameLink = item.querySelector('a') || item;
		if (!nameLink) return;

		ensureSpellNameLayout(nameLink as HTMLElement);

		if (nameLink.querySelector('.nimble-spell-tier-badge')) {
			return;
		}

		let badgeText = '';
		if (tier === 0) {
			badgeText = 'U';
		} else if (tier === 1) {
			badgeText = 'C';
		} else if (tier >= 2) {
			badgeText = String(tier - 1);
		}

		if (!badgeText) return;

		const badgeSpan = document.createElement('span');
		badgeSpan.className = 'nimble-spell-tier-badge';
		badgeSpan.style.marginLeft = 'auto';
		badgeSpan.style.marginRight = '6px';
		badgeSpan.style.display = 'inline-block';
		badgeSpan.textContent = badgeText;

		nameLink.appendChild(badgeSpan);
	} catch (error) {
		console.warn('Nimble: Error adding tier badge to item:', error);
	}
}

function setupClearFiltersButton(header: HTMLElement, app: any, collection: any): void {
	const targetSelectors = [
		'button[data-action="collapse"]',
		'button[data-action="collapse-all"]',
		'button.collapse-all',
		'button.collapse',
		'button[title*="Collapse"]',
	];

	const collapseButton =
		targetSelectors.map((selector) => header.querySelector(selector)).find((btn) => btn) || null;

	if (!collapseButton) {
		return;
	}

	ensureClearFiltersStyles();
	collapseButton.classList.add('nimble-clear-filters');
	collapseButton.removeAttribute('title');
	(collapseButton as HTMLElement).dataset.tooltip = 'Clear All Filters';
	collapseButton.innerHTML = '<i class="fa-solid fa-broom"></i>';

	const clearHandler = (event: Event) => {
		event.preventDefault();
		event.stopPropagation();

		activeSchoolFilter = '';
		const searchInput = app?.element?.querySelector?.(
			'input[type="search"]',
		) as HTMLInputElement | null;
		if (searchInput) {
			searchInput.value = '';
		}

		const btnGroup = header.querySelector('.nimble-spell-school-buttons');
		if (btnGroup) {
			btnGroup.querySelectorAll('.header-button.nimble-spell-school').forEach((btn) => {
				btn.classList.remove('active');
			});
			const allBtn = btnGroup.querySelector('.header-button.nimble-spell-school.all');
			if (allBtn) {
				allBtn.classList.add('active');
			}
		}

		applyFilter('', app?.collection || collection, app, collection);
	};

	collapseButton.addEventListener('click', clearHandler);
}

/**
 * Apply filter to compendium entries by school and sort by tier, then school, then alphabetically
 */
async function applyFilter(
	school: string,
	packFromApp: any,
	app: any,
	collection: any,
): Promise<void> {
	const TARGET_COLLECTION = GLOBAL_NIMBLE_SPELLS_COLLECTION;

	try {
		if (isApplyingFilter) {
			return;
		}
		isApplyingFilter = true;

		// Get the pack from packFromApp
		const pack = packFromApp || collection;
		if (!pack) {
			console.warn('Nimble: Unable to find pack for filtering');
			return;
		}

		// Load index with fallback chain
		let index: any[] = [];
		try {
			// Try primary method
			if (typeof pack.getIndex === 'function') {
				const indexData = await pack.getIndex({
					fields: ['system.school', 'system.tier', 'system.properties.selected', 'name'],
				});
				if (indexData && indexData.size > 0) {
					index = Array.from(indexData);
				} else if (pack.index && pack.index.size > 0) {
					// Fallback 1: use pack.index directly
					index = Array.from(pack.index);
				}
			}

			// Fallback 2: get documents directly
			if (index.length === 0 && typeof pack.getDocuments === 'function') {
				const docs = await pack.getDocuments();
				index = docs.map((doc: any) => ({
					_id: doc.id,
					name: doc.name || '',
					system: {
						school: doc.system?.school || '',
						tier: doc.system?.tier ?? 0,
						properties: { selected: doc.system?.properties?.selected || [] },
					},
				}));
			}

			// Fallback 3: use game.packs
			if (index.length === 0) {
				const gamePack = game.packs.get(TARGET_COLLECTION);
				if ((gamePack?.index?.size ?? 0) > 0) {
					index = Array.from(gamePack!.index);
				}
			}
		} catch (error) {
			console.warn('Nimble: Error loading pack index:', error);
			return;
		}

		// Get the compendium element with multiple selector fallbacks
		let compendiumElement: HTMLElement | null = null;
		const collectionAttr = TARGET_COLLECTION.split('.').pop() || 'nimble-spells';

		if (app?.element) {
			compendiumElement = app.element;
		} else if (typeof document !== 'undefined') {
			compendiumElement =
				document.querySelector(`.compendium[data-collection="${collectionAttr}"]`) ||
				document.querySelector(`.compendium[data-pack="${collectionAttr}"]`) ||
				document.querySelector(`.directory[data-collection="${collectionAttr}"]`);
		}

		if (!compendiumElement) {
			console.warn('Nimble: Unable to find compendium element for filtering');
			return;
		}

		ensureSchoolFilterStyles();
		applySchoolFilterClass(compendiumElement, school);

		const searchInput = compendiumElement.querySelector(
			'input[type="search"]',
		) as HTMLInputElement | null;
		const searchTerm = searchInput?.value?.trim() ?? '';
		const searchActive = searchTerm.length > 0;

		if (searchActive && school === '') {
			compendiumElement
				.querySelectorAll('.nimble-spell-tier-header, .nimble-spell-school-header')
				.forEach((header) => {
					header.remove();
				});
			return;
		}

		// Build maps (always build id->school/tier; only build grouping when not searching)
		const normalizedById = new Map<string, { school: string; tier: number }>();
		const nameById = new Map<string, string>();
		const spellsByTierAndSchool: {
			[tierKey: string]: {
				[schoolKey: string]: Array<{ _id: string; name: string; tier: number; school: string }>;
			};
		} = {};
		const allowedIds = new Set<string>();

		index.forEach((entry: any) => {
			const normalized = normalizeIndexEntry(entry);
			if (normalized._id) {
				normalizedById.set(normalized._id, {
					school: normalized.system.school,
					tier: normalized.system.tier ?? 0,
				});
				const name = (entry?.name || '').toString().toLowerCase();
				if (name) {
					nameById.set(normalized._id, name);
				}
			}

			if (!searchActive) {
				const shouldInclude = school === '' || normalized.system.school === school;
				if (shouldInclude) {
					allowedIds.add(normalized._id);
					const tierKey = String(normalized.system.tier);
					const schoolKey = normalized.system.school || 'unknown';

					if (!spellsByTierAndSchool[tierKey]) {
						spellsByTierAndSchool[tierKey] = {};
					}
					if (!spellsByTierAndSchool[tierKey][schoolKey]) {
						spellsByTierAndSchool[tierKey][schoolKey] = [];
					}

					spellsByTierAndSchool[tierKey][schoolKey].push({
						_id: normalized._id,
						name: entry.name || '',
						tier: normalized.system.tier,
						school: normalized.system.school,
					});
				}
			}
		});

		cachedSpellDataById = normalizedById;
		cachedSpellNameById = nameById;

		if (searchActive) {
			compendiumElement
				.querySelectorAll('.nimble-spell-tier-header, .nimble-spell-school-header')
				.forEach((header) => {
					header.remove();
				});
			applyCachedMetadataToListItems(compendiumElement, cachedSpellDataById);
			return;
		}

		// Sort spells alphabetically within each school group
		Object.keys(spellsByTierAndSchool).forEach((tierKey) => {
			Object.keys(spellsByTierAndSchool[tierKey]).forEach((schoolKey) => {
				spellsByTierAndSchool[tierKey][schoolKey].sort((a, b) => a.name.localeCompare(b.name));
			});
		});

		// Find list container
		const listContainer =
			compendiumElement.querySelector('.directory-list') ||
			compendiumElement.querySelector('ol') ||
			compendiumElement.querySelector('ul');

		if (!listContainer) {
			console.warn('Nimble: Unable to find list container');
			return;
		}

		// Query for list items
		const listItems: NodeListOf<HTMLElement> = compendiumElement.querySelectorAll(
			'li[data-document-id], li[data-entry-id], .compendium-entry, .compendium-item, .directory-item',
		);

		// Create a map of items by ID for easy lookup
		const itemsById = new Map<string, HTMLElement>();
		listItems.forEach((item: HTMLElement) => {
			const itemId =
				item.getAttribute('data-document-id') ||
				item.getAttribute('data-entry-id') ||
				item.getAttribute('data-id') ||
				'';
			if (itemId) {
				itemsById.set(itemId, item);
			}
		});

		// Remove existing group headers
		compendiumElement
			.querySelectorAll('.nimble-spell-tier-header, .nimble-spell-school-header')
			.forEach((header) => {
				header.remove();
			});

		if (!searchActive) {
			// Sort tier keys: 0 (utility), 1 (cantrip), then 2-10
			const sortedTiers = Object.keys(spellsByTierAndSchool).sort((a, b) => {
				const aNum = parseInt(a, 10);
				const bNum = parseInt(b, 10);
				// Utility first (0), then cantrip (1), then 2-10
				if (aNum === 0) return -1;
				if (bNum === 0) return 1;
				if (aNum === 1) return -1;
				if (bNum === 1) return 1;
				return aNum - bNum;
			});

			// Define school display names and order
			const schoolDisplayNames: { [key: string]: string } = {
				fire: 'Fire',
				ice: 'Ice',
				lightning: 'Lightning',
				necrotic: 'Necrotic',
				radiant: 'Radiant',
				wind: 'Wind',
				secret: 'Secret',
				utility: 'Utility',
			};

			const schoolOrder = [
				'fire',
				'ice',
				'lightning',
				'necrotic',
				'radiant',
				'wind',
				'secret',
				'utility',
			];

			// Reorganize items with tier and school headers
			const fragment = document.createDocumentFragment();

			sortedTiers.forEach((tierKey) => {
				const tierNum = parseInt(tierKey, 10);
				const tierLabel = TIER_LABELS[tierNum] || `Tier ${tierNum}`;
				const tierSpellsBySchool = spellsByTierAndSchool[tierKey];

				// Create tier header
				const tierHeaderDiv = document.createElement('li');
				tierHeaderDiv.className = 'nimble-spell-tier-header';
				tierHeaderDiv.style.fontWeight = 'bold';
				// Use selected school's color when a specific school filter is active
				const tierColor =
					school === ''
						? '#ffffff'
						: SCHOOL_TIER_COLORS[school]
							? SCHOOL_TIER_COLORS[school]
							: '#b0860b';
				tierHeaderDiv.style.color = tierColor;
				tierHeaderDiv.style.paddingLeft = '6px';
				tierHeaderDiv.style.paddingTop = '8px';
				tierHeaderDiv.style.paddingBottom = '4px';
				tierHeaderDiv.style.fontSize = '0.9rem';
				tierHeaderDiv.style.borderTop = '1px solid rgba(176, 134, 11, 0.3)';
				tierHeaderDiv.style.marginTop = '8px';
				tierHeaderDiv.textContent = `${tierLabel} Spells`;

				fragment.appendChild(tierHeaderDiv);

				// Process schools in sorted order
				schoolOrder.forEach((schoolKey) => {
					const schoolSpells = tierSpellsBySchool[schoolKey];
					if (schoolSpells && schoolSpells.length > 0) {
						// Create and insert school header only for the 'All' view (no specific school filter)
						if (school === '') {
							const schoolDisplayName = schoolDisplayNames[schoolKey] || schoolKey;
							const schoolHeaderDiv = document.createElement('li');
							schoolHeaderDiv.className = 'nimble-spell-school-header';
							schoolHeaderDiv.style.fontWeight = '600';
							const schoolHeaderColor =
								school === '' && SCHOOL_TIER_COLORS[schoolKey]
									? SCHOOL_TIER_COLORS[schoolKey]
									: school === ''
										? '#dddddd'
										: '#999999';
							schoolHeaderDiv.style.color = schoolHeaderColor;
							schoolHeaderDiv.style.paddingLeft = '18px';
							schoolHeaderDiv.style.paddingTop = '4px';
							schoolHeaderDiv.style.paddingBottom = '2px';
							schoolHeaderDiv.style.fontSize = school === '' ? '0.95rem' : '0.85rem';
							schoolHeaderDiv.style.fontStyle = 'italic';
							schoolHeaderDiv.style.marginTop = '4px';
							schoolHeaderDiv.textContent = schoolDisplayName;
							fragment.appendChild(schoolHeaderDiv);
						}

						// Move spell items to appear after this school header
						schoolSpells.forEach((spell) => {
							const item = itemsById.get(spell._id);
							if (item) {
								item.style.display = '';
								item.removeAttribute('data-nimble-school-hidden');
								// Add school icon to the spell name
								addSchoolIconToItem(item, spell.school);
								// Add tier badge to the spell name
								addTierBadgeToItem(item, spell.tier);
								fragment.appendChild(item);
							}
						});
					}
				});
			});

			// Append any hidden items at the end so the list order is consistent
			itemsById.forEach((item, itemId) => {
				if (!allowedIds.has(itemId)) {
					item.style.display = 'none';
					item.setAttribute('data-nimble-school-hidden', '1');
					fragment.appendChild(item);
				}
			});

			listContainer.appendChild(fragment);
		}

		// Hide items not in allowedIds
		itemsById.forEach((item, itemId) => {
			if (!allowedIds.has(itemId)) {
				item.style.display = 'none';
				item.setAttribute('data-nimble-school-hidden', '1');
			} else {
				if (!searchActive) {
					item.style.display = '';
				}
				item.removeAttribute('data-nimble-school-hidden');
				const normalized = normalizedById.get(itemId);
				if (normalized) {
					item.setAttribute('data-nimble-school', normalized.school || '');
					if (normalized.school) {
						addSchoolIconToItem(item, normalized.school);
					}
					addTierBadgeToItem(item, normalized.tier);
				}
			}
		});
	} catch (error) {
		console.error('Nimble: Error applying spell filter:', error);
	} finally {
		isApplyingFilter = false;
	}
}

/**
 * Initialize school icon buttons in the compendium header
 */
function initializeSchoolButtons(container: HTMLElement, app: any, collection: any): void {
	async function loadAndRenderButtons() {
		const TARGET_COLLECTION = GLOBAL_NIMBLE_SPELLS_COLLECTION;

		try {
			// Extract CompendiumCollection from app or use directly
			const pack = app?.collection || collection;
			if (!pack) {
				console.warn('Nimble: Unable to find collection for button initialization');
				return;
			}

			// Load pack index
			let index: any[] = [];
			try {
				if (typeof pack.getIndex === 'function') {
					const indexData = await pack.getIndex({
						fields: ['system.school', 'system.tier', 'system.properties.selected', 'name'],
					});
					if (indexData && indexData.size > 0) {
						index = Array.from(indexData);
					} else if (pack.index && pack.index.size > 0) {
						index = Array.from(pack.index);
					}
				}

				if (index.length === 0 && typeof pack.getDocuments === 'function') {
					const docs = await pack.getDocuments();
					index = docs.map((doc: any) => ({
						_id: doc.id,
						name: doc.name || '',
						system: {
							school: doc.system?.school || '',
							tier: doc.system?.tier ?? 0,
							properties: { selected: doc.system?.properties?.selected || [] },
						},
					}));
				}

				if (index.length === 0) {
					const gamePack = game.packs.get(TARGET_COLLECTION);
					if ((gamePack?.index?.size ?? 0) > 0) {
						index = Array.from(gamePack!.index);
					}
				}
			} catch (error) {
				console.warn('Nimble: Error loading index for button initialization:', error);
				return;
			}

			// Extract unique schools into a Set
			const schoolsSet = new Set<string>();
			index.forEach((entry: any) => {
				const normalized = normalizeIndexEntry(entry);
				if (normalized.system.school) {
					schoolsSet.add(normalized.system.school);
				}
			});

			const schools = Array.from(schoolsSet).sort();

			// Define school icons mapping
			const schoolIcons: { [key: string]: string } = {
				fire: 'fa-solid fa-fire',
				ice: 'fa-solid fa-snowflake',
				lightning: 'fa-solid fa-bolt',
				necrotic: 'fa-solid fa-skull',
				radiant: 'fa-solid fa-sun',
				wind: 'fa-solid fa-wind',
			};

			// Create or find button group container
			let btnGroup = container.querySelector('.nimble-spell-school-buttons') as HTMLElement;
			if (!btnGroup) {
				btnGroup = document.createElement('div');
				btnGroup.className = 'nimble-spell-school-buttons';
				btnGroup.style.display = 'flex';
				btnGroup.style.justifyContent = 'center';
				btnGroup.style.gap = '12px';
				btnGroup.style.alignItems = 'center';
				btnGroup.style.marginLeft = '6px';
				btnGroup.style.flex = '1';
				container.appendChild(btnGroup);
			}
			btnGroup.innerHTML = '';

			// Create "All" button
			const allBtn = document.createElement('button');
			allBtn.className = 'header-button nimble-spell-school all';
			allBtn.removeAttribute('title');
			allBtn.dataset.tooltip = ((game.i18n.localize('NIMBLE.compendium.filterAll') as string) ||
				'All') as string;
			allBtn.innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
			allBtn.style.display = 'inline-block';
			allBtn.style.cursor = 'pointer';
			allBtn.addEventListener('click', (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
				activeSchoolFilter = '';
				applyFilter('', pack, app, collection);
				// Update active state
				btnGroup.querySelectorAll('.header-button.nimble-spell-school').forEach((btn) => {
					btn.classList.remove('active');
				});
				allBtn.classList.add('active');
			});
			btnGroup.appendChild(allBtn);

			// Create buttons for each school
			schools.forEach((school: string) => {
				if (schoolIcons[school]) {
					const schoolLabel = school.charAt(0).toUpperCase() + school.slice(1);
					const btn = document.createElement('button');
					btn.className = 'header-button nimble-spell-school';
					btn.setAttribute('data-school', school);
					btn.removeAttribute('title');
					btn.dataset.tooltip = schoolLabel;
					btn.innerHTML = `<i class="${schoolIcons[school]}"></i>`;
					btn.style.display = 'inline-block';
					btn.style.cursor = 'pointer';
					btn.addEventListener('click', (e: Event) => {
						e.preventDefault();
						e.stopPropagation();
						activeSchoolFilter = school;
						applyFilter(school, pack, app, collection);
						// Update active state
						btnGroup.querySelectorAll('.header-button.nimble-spell-school').forEach((b) => {
							b.classList.remove('active');
						});
						btn.classList.add('active');
					});
					btnGroup.appendChild(btn);
				}
			});
		} catch (error) {
			console.error('Nimble: Error initializing school buttons:', error);
		}
	}

	loadAndRenderButtons();
}

/**
 * Add school icons to all spells on initial render (no filtering yet)
 */
async function addIconsToAllSpells(app: any, collection: any): Promise<void> {
	const TARGET_COLLECTION = GLOBAL_NIMBLE_SPELLS_COLLECTION;

	try {
		const pack = app?.collection || collection;
		if (!pack) {
			return;
		}

		// Load pack index
		let index: any[] = [];
		try {
			if (typeof pack.getIndex === 'function') {
				const indexData = await pack.getIndex({
					fields: ['system.school', 'system.tier', 'system.properties.selected', 'name'],
				});
				if (indexData && indexData.size > 0) {
					index = Array.from(indexData);
				} else if (pack.index && pack.index.size > 0) {
					index = Array.from(pack.index);
				}
			}

			if (index.length === 0 && typeof pack.getDocuments === 'function') {
				const docs = await pack.getDocuments();
				index = docs.map((doc: any) => ({
					_id: doc.id,
					name: doc.name || '',
					system: {
						school: doc.system?.school || '',
						tier: doc.system?.tier ?? 0,
						properties: { selected: doc.system?.properties?.selected || [] },
					},
				}));
			}

			if (index.length === 0) {
				const gamePack = game.packs.get(TARGET_COLLECTION);
				if ((gamePack?.index?.size ?? 0) > 0) {
					index = Array.from(gamePack!.index);
				}
			}
		} catch (error) {
			console.warn('Nimble: Error loading index for icon render:', error);
			return;
		}

		// Map id -> school/tier
		const dataById = new Map<string, { school: string; tier: number }>();
		const nameById = new Map<string, string>();
		index.forEach((entry: any) => {
			const normalized = normalizeIndexEntry(entry);
			if (normalized._id) {
				dataById.set(normalized._id, {
					school: normalized.system.school,
					tier: normalized.system.tier ?? 0,
				});
				const name = (entry?.name || '').toString().toLowerCase();
				if (name) {
					nameById.set(normalized._id, name);
				}
			}
		});
		cachedSpellDataById = dataById;
		cachedSpellNameById = nameById;

		// Find compendium element
		let compendiumElement: HTMLElement | null = null;
		const collectionAttr = TARGET_COLLECTION.split('.').pop() || 'nimble-spells';

		if (app?.element) {
			compendiumElement = app.element;
		} else if (typeof document !== 'undefined') {
			compendiumElement =
				document.querySelector(`.compendium[data-collection="${collectionAttr}"]`) ||
				document.querySelector(`.compendium[data-pack="${collectionAttr}"]`) ||
				document.querySelector(`.directory[data-collection="${collectionAttr}"]`);
		}

		if (!compendiumElement) {
			return;
		}

		// Apply icon to each item
		const listItems: NodeListOf<HTMLElement> = compendiumElement.querySelectorAll(
			'li[data-document-id], li[data-entry-id], .compendium-entry, .compendium-item, .directory-item',
		);

		listItems.forEach((item: HTMLElement) => {
			const itemId =
				item.getAttribute('data-document-id') ||
				item.getAttribute('data-entry-id') ||
				item.getAttribute('data-id') ||
				'';
			if (itemId) {
				const data = dataById.get(itemId);
				if (data) {
					item.setAttribute('data-nimble-school', data.school || '');
					if (data.school) {
						addSchoolIconToItem(item, data.school);
					}
					addTierBadgeToItem(item, data.tier);
				}
			}
		});
	} catch (error) {
		console.error('Nimble: Error adding icons to spells:', error);
	}
}

/**
 * Register the renderCompendium hook to add filter buttons
 */
export default function registerCompendiumSpellsFilter(): void {
	const TARGET_COLLECTION = GLOBAL_NIMBLE_SPELLS_COLLECTION;

	Hooks.on('renderCompendium', (app: any, html: any) => {
		try {
			// Handle both string collection and CompendiumCollection object
			let collectionId = app?.collection?.metadata?.id || app?.collection?.id || app?.pack;

			// Additional fallback for collection resolution
			if (!collectionId && app?.document?.pack) {
				collectionId = app.document.pack;
			}

			if (collectionId !== TARGET_COLLECTION) {
				return;
			}

			// Find header element
			const header =
				html?.querySelector?.('.compendium-header') ||
				html?.querySelector?.('.window-header') ||
				html;

			if (!header) {
				return;
			}

			// Skip if already initialized
			if (header.querySelector('.nimble-spell-school-buttons')) {
				return;
			}

			// Initialize the buttons
			initializeSchoolButtons(header, app, app?.collection);
			setupClearFiltersButton(header, app, app?.collection);

			// Add school icons to the initial list (no filtering)
			addIconsToAllSpells(app, app?.collection);

			ensureSchoolFilterStyles();
			applySchoolFilterClass(app?.element || null, activeSchoolFilter);

			const searchInput = html?.querySelector?.('input[type="search"]') as HTMLInputElement | null;
			if (searchInput && !searchInput.dataset.nimbleSpellSearchBound) {
				searchInput.dataset.nimbleSpellSearchBound = '1';
				const applyActiveSchoolClass = () => {
					applySchoolFilterClass(app?.element || null, activeSchoolFilter);
					applyCachedMetadataToListItems(app?.element || null, cachedSpellDataById);
				};

				searchInput.addEventListener(
					'input',
					(e: Event) => {
						e.preventDefault();
						e.stopImmediatePropagation();

						applyActiveSchoolClass();
						const term = searchInput.value || '';
						if (!term.trim()) {
							applyFilter(activeSchoolFilter, app?.collection, app, app?.collection);
							return;
						}
						html
							?.querySelectorAll?.('.nimble-spell-tier-header, .nimble-spell-school-header')
							.forEach((header: Element) => {
								header.remove();
							});
						applySearchFilter(app?.element || null, term, cachedSpellNameById);
					},
					true,
				);
			}

			const listContainer =
				html?.querySelector?.('.directory-list') ||
				html?.querySelector?.('ol') ||
				html?.querySelector?.('ul');
			if (listContainer && !(listContainer as HTMLElement).dataset.nimbleSpellObserver) {
				(listContainer as HTMLElement).dataset.nimbleSpellObserver = '1';
				const observer = new MutationObserver(() => {
					applyCachedMetadataToListItems(app?.element || null, cachedSpellDataById);
				});
				observer.observe(listContainer, { childList: true, subtree: true });
			}
		} catch (error) {
			console.error('Nimble: Error in renderCompendium hook:', error);
		}
	});
}
