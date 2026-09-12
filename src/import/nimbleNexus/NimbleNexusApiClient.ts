/**
 * API client for fetching monsters from nimble.nexus
 */

import {
	DEFAULT_PAGE_LIMIT,
	MAX_PAGE_LIMIT,
	MONSTER_INCLUDES,
	NIMBLE_NEXUS_API_URL,
} from './constants.js';
import type {
	NimbleNexusApiResponse,
	NimbleNexusApiSearchOptions,
	NimbleNexusCreatedResource,
	NimbleNexusCreator,
	NimbleNexusInclude,
	NimbleNexusIncludedResource,
	NimbleNexusMonster,
	NimbleNexusSingleMonsterResponse,
} from './types.js';

/**
 * Error class for API-specific errors
 */
export class NimbleNexusApiError extends Error {
	status: number;
	statusText: string;

	constructor(message: string, status: number, statusText: string) {
		super(message);
		this.name = 'NimbleNexusApiError';
		this.status = status;
		this.statusText = statusText;
	}
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | undefined>): string {
	const url = new URL(`${NIMBLE_NEXUS_API_URL}${endpoint}`);

	if (params) {
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') {
				url.searchParams.set(key, String(value));
			}
		}
	}

	return url.toString();
}

/**
 * Perform a fetch request with error handling
 */
async function fetchWithErrorHandling<T>(url: string): Promise<T> {
	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new NimbleNexusApiError(
				`API request failed: ${response.statusText}`,
				response.status,
				response.statusText,
			);
		}

		return (await response.json()) as T;
	} catch (error) {
		if (error instanceof NimbleNexusApiError) {
			throw error;
		}

		// Network errors or other fetch failures
		throw new NimbleNexusApiError(
			error instanceof Error ? error.message : 'Unknown network error',
			0,
			'Network Error',
		);
	}
}

/**
 * Ask for the creator alongside whatever the caller wanted, keeping only what
 * the endpoint declares it supports.
 */
function resolveInclude(supported: NimbleNexusInclude[], requested?: NimbleNexusInclude[]): string {
	const wanted = new Set<NimbleNexusInclude>([...(requested ?? []), 'creator']);
	return supported.filter((value) => wanted.has(value)).join(',');
}

function readString(attributes: Record<string, unknown> | undefined, key: string): string {
	const value = attributes?.[key];
	return typeof value === 'string' ? value : '';
}

/**
 * Index the side-loaded user resources by id. The API deduplicates them across
 * the whole page, so many resources can share one entry.
 */
function indexCreators(included?: NimbleNexusIncludedResource[]): Map<string, NimbleNexusCreator> {
	const creators = new Map<string, NimbleNexusCreator>();

	for (const resource of included ?? []) {
		if (resource.type !== 'users') continue;

		creators.set(resource.id, {
			username: readString(resource.attributes, 'username'),
			displayName: readString(resource.attributes, 'displayName'),
		});
	}

	return creators;
}

/**
 * Resolve each resource's creator relationship against the side-loaded users.
 */
function attachCreators<T extends NimbleNexusCreatedResource>(
	resources: T[],
	included?: NimbleNexusIncludedResource[],
): T[] {
	const creators = indexCreators(included);
	if (!creators.size) return resources;

	return resources.map((resource) => {
		const ref = resource.relationships?.creator?.data;
		const creator = ref ? creators.get(ref.id) : undefined;

		return creator ? { ...resource, creator } : resource;
	});
}

/**
 * Search for monsters with optional filters
 */
export async function searchMonsters(
	options: NimbleNexusApiSearchOptions = {},
): Promise<NimbleNexusApiResponse> {
	const limit = Math.min(options.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

	const params: Record<string, string | number | undefined> = {
		search: options.search,
		level: options.level,
		limit,
		cursor: options.cursor,
		sort: options.sort,
		include: resolveInclude(MONSTER_INCLUDES, options.include),
		type: options.monsterType !== 'all' ? options.monsterType : undefined,
		role: options.role !== 'all' ? options.role : undefined,
	};

	const url = buildUrl('/monsters', params);
	const response = await fetchWithErrorHandling<NimbleNexusApiResponse>(url);

	return { ...response, data: attachCreators(response.data, response.included) };
}

/**
 * Get a single monster by ID
 */
export async function getMonsterById(id: string): Promise<NimbleNexusMonster> {
	const url = buildUrl(`/monsters/${id}`, { include: resolveInclude(MONSTER_INCLUDES) });
	const response = await fetchWithErrorHandling<NimbleNexusSingleMonsterResponse>(url);
	const [monster] = attachCreators([response.data], response.included);

	return monster;
}

/**
 * Get paginated list of monsters
 */
export async function paginateMonsters(
	cursor?: string,
	limit: number = DEFAULT_PAGE_LIMIT,
	sort?: NimbleNexusApiSearchOptions['sort'],
): Promise<NimbleNexusApiResponse> {
	return searchMonsters({ cursor, limit, sort });
}

/**
 * Extract cursor from next link URL
 */
export function extractCursorFromNextLink(nextLink?: string): string | undefined {
	if (!nextLink) return undefined;

	try {
		const url = new URL(nextLink, NIMBLE_NEXUS_API_URL);
		return url.searchParams.get('cursor') ?? undefined;
	} catch {
		return undefined;
	}
}

/**
 * NimbleNexusApiClient class providing a unified interface
 */
export class NimbleNexusApiClient {
	/**
	 * Search for monsters
	 */
	async search(options: NimbleNexusApiSearchOptions = {}): Promise<NimbleNexusApiResponse> {
		return searchMonsters(options);
	}

	/**
	 * Get a single monster by ID
	 */
	async getById(id: string): Promise<NimbleNexusMonster> {
		return getMonsterById(id);
	}

	/**
	 * Get paginated results
	 */
	async paginate(
		cursor?: string,
		limit?: number,
		sort?: NimbleNexusApiSearchOptions['sort'],
	): Promise<NimbleNexusApiResponse> {
		return paginateMonsters(cursor, limit, sort);
	}

	/**
	 * Get next page cursor from response
	 */
	getNextCursor(response: NimbleNexusApiResponse): string | undefined {
		return extractCursorFromNextLink(response.links?.next);
	}
}

// Export a singleton instance for convenience
export const nimbleNexusApi = new NimbleNexusApiClient();
