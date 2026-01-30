/**
 * Spell School Icon Filter for Nimble Spells Compendium
 * Adds clickable icon buttons to filter spells by school and sorts by tier with group headers
 */

const GLOBAL_NIMBLE_SPELLS_COLLECTION = 'nimble.nimble-spells';

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
function normalizeIndexEntry(e: any): { _id: string; system: { school: string; tier: number } } {
	// Handle array-based entries where _id is at index 0 and payload at indices 1-2
	if (Array.isArray(e)) {
		const [_id, field1, field2] = e;
		const payload = field2 || field1 || {};
		return {
			_id,
			system: {
				school: payload.system?.school || payload.school || '',
				tier: payload.system?.tier ?? payload.tier ?? 0,
			},
		};
	}

	// Handle object-based entries
	if (typeof e === 'object' && e !== null) {
		// Direct system.school and system.tier fields
		if (e.system?.school !== undefined) {
			return {
				_id: e._id,
				system: {
					school: e.system.school,
					tier: e.system?.tier ?? 0,
				},
			};
		}

		// Alternate field paths
		if (e.school) {
			return {
				_id: e._id,
				system: {
					school: e.school,
					tier: e.tier ?? 0,
				},
			};
		}

		// Default case
		return {
			_id: e._id,
			system: {
				school: e.system?.school || '',
				tier: e.system?.tier ?? 0,
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
				const indexData = await pack.getIndex({ fields: ['system.school', 'system.tier', 'name'] });
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
					system: { school: doc.system?.school || '', tier: doc.system?.tier ?? 0 },
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

		// Build nested Map: tier -> school -> spells (with names)
		const spellsByTierAndSchool: {
			[tierKey: string]: {
				[schoolKey: string]: Array<{ _id: string; name: string; tier: number; school: string }>;
			};
		} = {};
		const allowedIds = new Set<string>();

		index.forEach((entry: any) => {
			const normalized = normalizeIndexEntry(entry);
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
		});

		// Sort spells alphabetically within each school group
		Object.keys(spellsByTierAndSchool).forEach((tierKey) => {
			Object.keys(spellsByTierAndSchool[tierKey]).forEach((schoolKey) => {
				spellsByTierAndSchool[tierKey][schoolKey].sort((a, b) => a.name.localeCompare(b.name));
			});
		});

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
		const firstAllowedItemId = (() => {
			for (const tierKey of sortedTiers) {
				const tierSchools = spellsByTierAndSchool[tierKey];
				for (const schoolKey of schoolOrder) {
					if (tierSchools[schoolKey]?.length > 0) {
						return tierSchools[schoolKey][0]._id;
					}
				}
			}
			return null;
		})();
		let insertBeforeItem: HTMLElement | null = firstAllowedItemId
			? itemsById.get(firstAllowedItemId) || null
			: null;

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
				school && SCHOOL_TIER_COLORS[school] ? SCHOOL_TIER_COLORS[school] : '#b0860b';
			tierHeaderDiv.style.color = tierColor;
			tierHeaderDiv.style.paddingLeft = '6px';
			tierHeaderDiv.style.paddingTop = '8px';
			tierHeaderDiv.style.paddingBottom = '4px';
			tierHeaderDiv.style.fontSize = '0.9rem';
			tierHeaderDiv.style.borderTop = '1px solid rgba(176, 134, 11, 0.3)';
			tierHeaderDiv.style.marginTop = '8px';
			tierHeaderDiv.textContent = `${tierLabel} Spells`;

			// Insert tier header
			if (insertBeforeItem) {
				insertBeforeItem.parentNode?.insertBefore(tierHeaderDiv, insertBeforeItem);
			} else {
				listContainer.appendChild(tierHeaderDiv);
			}

			// Process schools in sorted order
			schoolOrder.forEach((schoolKey) => {
				const schoolSpells = tierSpellsBySchool[schoolKey];
				if (!schoolSpells || schoolSpells.length === 0) {
					return;
				}

				// Create and insert school header only for the 'All' view (no specific school filter)
				if (school === '') {
					const schoolDisplayName = schoolDisplayNames[schoolKey] || schoolKey;
					const schoolHeaderDiv = document.createElement('li');
					schoolHeaderDiv.className = 'nimble-spell-school-header';
					schoolHeaderDiv.style.fontWeight = '600';
					schoolHeaderDiv.style.color = '#999999';
					schoolHeaderDiv.style.paddingLeft = '18px';
					schoolHeaderDiv.style.paddingTop = '4px';
					schoolHeaderDiv.style.paddingBottom = '2px';
					schoolHeaderDiv.style.fontSize = '0.85rem';
					schoolHeaderDiv.style.fontStyle = 'italic';
					schoolHeaderDiv.style.marginTop = '4px';
					schoolHeaderDiv.textContent = schoolDisplayName;

					// Insert school header
					if (insertBeforeItem) {
						insertBeforeItem.parentNode?.insertBefore(schoolHeaderDiv, insertBeforeItem);
					} else {
						listContainer.appendChild(schoolHeaderDiv);
					}
				}

				// Move spell items to appear after this school header
				schoolSpells.forEach((spell) => {
					const item = itemsById.get(spell._id);
					if (item) {
						item.style.display = '';
						// Add school icon to the spell name
						addSchoolIconToItem(item, spell.school);
						// Add tier badge to the spell name
						addTierBadgeToItem(item, spell.tier);
						// Move item to be after the header
						if (insertBeforeItem) {
							insertBeforeItem.parentNode?.insertBefore(item, insertBeforeItem);
						}
					}
				});

				// Update insertBeforeItem to be the next item to insert before
				if (schoolSpells.length > 0) {
					const lastSpellItem = itemsById.get(schoolSpells[schoolSpells.length - 1]._id);
					if (lastSpellItem?.nextElementSibling) {
						insertBeforeItem = lastSpellItem.nextElementSibling as HTMLElement;
					}
				}
			});
		});

		// Hide items not in allowedIds
		itemsById.forEach((item, itemId) => {
			if (!allowedIds.has(itemId)) {
				item.style.display = 'none';
			}
		});
	} catch (error) {
		console.error('Nimble: Error applying spell filter:', error);
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
					const indexData = await pack.getIndex({ fields: ['system.school', 'system.tier'] });
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
						system: { school: doc.system?.school || '', tier: doc.system?.tier ?? 0 },
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
			allBtn.title = (game.i18n.localize('NIMBLE.compendium.filterAll') as string) || 'All';
			allBtn.innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
			allBtn.style.display = 'inline-block';
			allBtn.style.cursor = 'pointer';
			allBtn.addEventListener('click', (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
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
				if (!schoolIcons[school]) {
					return; // Skip unknown schools
				}

				const btn = document.createElement('button');
				btn.className = 'header-button nimble-spell-school';
				btn.setAttribute('data-school', school);
				btn.title = school;
				btn.innerHTML = `<i class="${schoolIcons[school]}"></i>`;
				btn.style.display = 'inline-block';
				btn.style.cursor = 'pointer';
				btn.addEventListener('click', (e: Event) => {
					e.preventDefault();
					e.stopPropagation();
					applyFilter(school, pack, app, collection);
					// Update active state
					btnGroup.querySelectorAll('.header-button.nimble-spell-school').forEach((b) => {
						b.classList.remove('active');
					});
					btn.classList.add('active');
				});
				btnGroup.appendChild(btn);
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
				const indexData = await pack.getIndex({ fields: ['system.school'] });
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
					system: { school: doc.system?.school || '' },
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
		index.forEach((entry: any) => {
			const normalized = normalizeIndexEntry(entry);
			if (normalized._id) {
				dataById.set(normalized._id, {
					school: normalized.system.school,
					tier: normalized.system.tier ?? 0,
				});
			}
		});

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
			if (!itemId) return;

			const data = dataById.get(itemId);
			if (!data) return;
			if (data.school) {
				addSchoolIconToItem(item, data.school);
			}
			addTierBadgeToItem(item, data.tier);
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

			// Add school icons to the initial list (no filtering)
			addIconsToAllSpells(app, app?.collection);
		} catch (error) {
			console.error('Nimble: Error in renderCompendium hook:', error);
		}
	});
}
