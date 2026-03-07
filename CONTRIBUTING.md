## 🚀 Quick Start

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

- **`pnpm build`** - Build the system and compendia for production
- **`pnpm build:system`** - Build only the system files
- **`pnpm build:compendia`** - Build only the compendia data
- **`pnpm dev`** - Start development server with hot reload
- **`pnpm format`** - Format code with Biome
- **`pnpm lint`** - Lint code with Biome
- **`pnpm lint-fix`** - Auto-fix linting issues
- **`pnpm type-check`** - Run TypeScript type checking
- **`pnpm check`** - Run all checks (format, lint, circular dependencies, type-check, tests)

## 📁 Project Structure

```
FoundryVTT-Nimble/
├── src/                          # Main source code
│   ├── nimble.ts                 # Main entry point
│   ├── config.ts                 # System configuration
│   ├── game.ts                   # Game instance setup
│   ├── hooks/                    # FoundryVTT lifecycle hooks
│   │   ├── init.ts              # System initialization
│   │   ├── setup.ts             # System setup
│   │   ├── ready.ts             # System ready state
│   │   └── ...
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
├── vite.config.mts               # Vite configuration
├── svelte.config.js              # Svelte configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
└── compendia.mjs                 # Compendia build script
```

## 🔧 Key Files

### Core System Files

- **[`src/nimble.ts`](src/nimble.ts)** - Main entry point that registers all hooks and initializes the system
- **[`src/config.ts`](src/config.ts)** - System configuration including ability scores, damage types, classes, and game constants
- **[`src/hooks/init.ts`](src/hooks/init.ts)** - System initialization hook that registers document classes, sheets, and data models
- **[`src/game.ts`](src/game.ts)** - Game instance setup and global utilities

### Build Configuration

- **[`vite.config.mts`](vite.config.mts)** - Vite configuration with FoundryVTT proxy setup
- **[`svelte.config.js`](svelte.config.js)** - Svelte preprocessor configuration
- **[`tsconfig.json`](tsconfig.json)** - TypeScript configuration with FoundryVTT types

### Development Tools

- **[`package.json`](package.json)** - Project dependencies and pnpm scripts
- **[`compendia.mjs`](compendia.mjs)** - Script for building game content compendia

## 🏗️ Architecture

### Technology Stack

- **Frontend Framework:** Svelte 5 with TypeScript
- **Build Tool:** Vite
- **Styling:** SCSS with custom functions and variables
- **Icons:** Font Awesome
- **Canvas:** PIXI.js integration
- **Linting/Formatting:** Biome
- **Type Checking:** TypeScript with FoundryVTT type definitions

### Key Features

- **Custom Dice System:** NimbleRoll and DamageRoll implementations
- **Svelte Components:** Modern UI components for character sheets and dialogs
- **Compendia System:** Game content packaged as compendia
- **Modular Architecture:** Clean separation of concerns with hooks, documents, and views
- **Hot Reload:** Development server with live reloading

### FoundryVTT Integration

The system integrates deeply with FoundryVTT through:

- **Document Classes:** Custom Actor, Item, and Combat implementations
- **Application Sheets:** Svelte-based character and item sheets
- **Canvas Integration:** Custom template layer and token HUD
- **Hooks System:** Proper lifecycle management
- **Data Models:** Type-safe data structures for all game entities

## 🤝 Contributing

1. Fork the repository
2. Ensure you're on the `dev` branch: `git checkout dev`
3. Create a feature branch from `dev`: `git checkout -b feature/your-feature`
4. Make your changes and ensure tests pass
5. Run checks before committing: `pnpm check`
6. Commit your changes: `git commit -am 'Add some feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Submit a pull request **against the `dev` branch**

> **Note:** All development work should branch from `dev` and all pull requests should target `dev`. The `main` branch is reserved for releases.

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style and patterns
- Run `pnpm check` before committing (formats, lints, checks for circular dependencies, type-checks, and runs tests)
- Test your changes in FoundryVTT
- Update documentation as needed

## 📦 Deployment

1. Build the system: `pnpm build`
2. Copy the `dist/` folder to your FoundryVTT `systems/nimble/` directory
3. Restart FoundryVTT or reload the system

## 📚 External Documentation

### Everyday Knowledge

Used directly and frequently while working in the codebase.

- **TypeScript Docs**: <https://www.typescriptlang.org/docs/>
  Language reference for typing, generics, and strict mode used across the project.
- **Svelte Docs**: <https://svelte.dev/docs>
  UI framework for character sheets and dialogs. Reactivity and component lifecycle.
- **FoundryVTT API**: <https://foundryvtt.com/api/>
  Core Foundry classes, hooks, sheets, dialogs, combat, and system integration.
- **FoundryVTT Community Wiki**: <https://foundryvtt.wiki/en/home>
  Practical guides, patterns, common pitfalls, and system-level behavior not always obvious from the API docs.
- **FoundryVTT TypeScript Types**: <https://github.com/League-of-Foundry-Developers/foundry-vtt-types>
  Type definitions for Foundry APIs. Required for TypeScript safety and IDE autocomplete.

### Occasional Reference

Only needed when working in specific areas or diagnosing issues.

- **Vite Guide**: <https://vite.dev/guide/>
  Build tool and dev server for local development and bundling.
- **Biome**: <https://biomejs.dev/>
  Formatter and linter enforcing code style and consistency.
- **Vitest**: <https://vitest.dev/>
  Unit testing framework used for system tests.
