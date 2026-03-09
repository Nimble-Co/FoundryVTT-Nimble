# Commit Grouping Table

When staging commits, group files by logical concern — never commit unrelated changes together:

| Group | Files to Group Together |
|-------|------------------------|
| New Svelte sheet | Sheet class (`.svelte.ts`), Svelte component (`.svelte`), props type (`types/components/`), SCSS partial (`_*.scss`) |
| Document/model change | Document class, data model, related type definitions |
| Hook changes | Hook files in `src/hooks/` |
| Utility changes | Utility files + their test files (`*.test.ts`) |
| Config/constants | `src/config.ts` + any files that reference the new constants |
| Compendium content | JSON files in `packs/` |
| Build/tooling | `vite.config.mts`, `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `svelte.config.js` |
