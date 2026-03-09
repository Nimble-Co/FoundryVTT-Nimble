# Svelte 5 Script Order — Quick Reference

The 10-item order for `<script lang="ts">` blocks in all Nimble Svelte components:

1. **Type imports** — `import type { ... } from '...'`
2. **Component imports** — `import Foo from '#view/...'`
3. **Utility imports** — `import { localize } from '#utils/...'`
4. **Store imports** — `import { someStore } from '#stores/...'`
5. **Context** — `const ctx = getContext<...>('key')`
6. **Props** — `const { document, ... }: SheetNameProps = $props()`
7. **Local state** — `let open = $state(false)`
8. **Derived values** — `const label = $derived(localize(document.name))`
9. **Effects** — `$effect(() => { ... })`
10. **Functions** — `function handleClick() { ... }`
