/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "no-circular",
			severity: "error",
			comment: "Circular dependencies can cause runtime issues and make code harder to understand",
			from: {},
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
