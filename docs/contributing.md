---
title: Contributing
---

# Contributing

## Quick Start

### Prerequisites

- **Node.js** >= 22.1.0
- **FoundryVTT** running locally (for development)
- **Git** for version control

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Nimble-Co/FoundryVTT-Nimble.git
   cd FoundryVTT-Nimble
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the development server:**
   ```bash
   pnpm dev
   ```

   This will start a Vite development server on `http://localhost:30001` that proxies to your local FoundryVTT instance running on port 30000.

4. **Configure FoundryVTT:**
   - Ensure FoundryVTT is running on `http://localhost:30000`
   - The development server will automatically proxy requests to your FoundryVTT instance
   - The system will be available at `/systems/nimble/` in your FoundryVTT installation

### Build Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the system and compendia for production |
| `pnpm build:system` | Build only the system files |
| `pnpm build:compendia` | Build only the compendia data |
| `pnpm dev` | Start development server with hot reload |
| `pnpm format` | Format code with Biome |
| `pnpm lint` | Lint code with Biome |
| `pnpm lint-fix` | Auto-fix linting issues |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm check` | Run all checks (format, lint, circular deps, type-check, tests) |

## Project Structure

```
FoundryVTT-Nimble/
├── src/                          # Main source code
│   ├── nimble.ts                 # Main entry point
│   ├── config.ts                 # System configuration
│   ├── game.ts                   # Game instance setup
│   ├── hooks/                    # FoundryVTT lifecycle hooks
│   ├── documents/                # Document classes (Actors, Items, etc.)
│   ├── models/                   # Data models
│   ├── dice/                     # Custom dice implementations
│   ├── canvas/                   # Canvas and rendering logic
│   ├── view/                     # Svelte components and UI
│   ├── utils/                    # Utility functions
│   ├── scss/                     # Stylesheets
│   └── pixi/                     # PIXI.js integrations
├── lib/                          # Svelte component mixins
├── packs/                        # Game content compendia
├── public/                       # Static assets
├── types/                        # TypeScript type definitions
└── vite.config.mts               # Vite configuration
```

## Architecture

### Technology Stack

- **Frontend Framework:** Svelte 5 with TypeScript
- **Build Tool:** Vite
- **Styling:** SCSS with custom functions and variables
- **Icons:** Font Awesome
- **Canvas:** PIXI.js integration
- **Linting/Formatting:** Biome
- **Type Checking:** TypeScript with FoundryVTT type definitions

## How to Contribute

1. Fork the repository
2. Ensure you're on the `dev` branch: `git checkout dev`
3. Create a feature branch from `dev`: `git checkout -b feature/your-feature`
4. Make your changes and ensure tests pass
5. Run checks before committing: `pnpm check`
6. Commit your changes: `git commit -am 'Add some feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Submit a pull request **against the `dev` branch**

::: tip
All development work should branch from `dev` and all pull requests should target `dev`. The `main` branch is reserved for releases.
:::

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style and patterns (see [Code Style Guide](/STYLE_GUIDE))
- Run `pnpm check` before committing
- Test your changes in FoundryVTT
- Update documentation as needed

## External Documentation

### Everyday Reference

- **[TypeScript Docs](https://www.typescriptlang.org/docs/)**, Language reference for typing, generics, and strict mode
- **[Svelte Docs](https://svelte.dev/docs)**, UI framework for character sheets and dialogs
- **[FoundryVTT API](https://foundryvtt.com/api/)**, Core Foundry classes, hooks, sheets, and system integration
- **[FoundryVTT Community Wiki](https://foundryvtt.wiki/en/home)**, Practical guides, patterns, and common pitfalls
- **[FoundryVTT TypeScript Types](https://github.com/League-of-Foundry-Developers/foundry-vtt-types)**, Type definitions for Foundry APIs

### Occasional Reference

- **[Vite Guide](https://vite.dev/guide/)**, Build tool and dev server
- **[Biome](https://biomejs.dev/)**, Formatter and linter
- **[Vitest](https://vitest.dev/)**, Unit testing framework
