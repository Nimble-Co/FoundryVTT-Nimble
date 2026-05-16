/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "no-circular",
			severity: "error",
			comment: "Circular dependencies can cause runtime issues and make code harder to understand",
			from: {
				// Svelte 5 deprecated `<svelte:self>` in favour of self-imports.
				// A recursive component importing itself is the supported pattern,
				// not a true circular dependency.
				pathNot: "src/view/rulesBuilder/components/SchemaFieldRenderer\\.svelte$",
			},
			to: {
				circular: true,
				// Exclude type-only imports since they're erased at compile time
				// and don't cause runtime circular dependency issues
				dependencyTypesNot: ["type-only"],
			},
		},
	],
	options: {
		doNotFollow: {
			path: ["node_modules"],
		},
		tsPreCompilationDeps: true,
		tsConfig: {
			fileName: "tsconfig.json",
		},
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default", "types"],
			mainFields: ["module", "main", "types", "typings"],
		},
		reporterOptions: {
			text: {
				highlightFocused: true,
			},
		},
	},
};
