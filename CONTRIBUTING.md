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
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

   This will start a Vite development server on `http://localhost:30001` that proxies to your local FoundryVTT instance running on port 30000.

4. **Configure FoundryVTT:**
   - Ensure FoundryVTT is running on `http://localhost:30000`
   - The development server will automatically proxy requests to your FoundryVTT instance
   - The system will be available at `/systems/nimble/` in your FoundryVTT installation

### Build Commands

- **`npm run build`** - Build the system and compendia for production
- **`npm run build:system`** - Build only the system files
- **`npm run build:compendia`** - Build only the compendia data
- **`npm run dev`** - Start development server with hot reload
- **`npm run format`** - Format code with Biome
- **`npm run lint`** - Lint code with Biome
- **`npm run lint-fix`** - Auto-fix linting issues
- **`npm run type-check`** - Run TypeScript type checking

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

- **[`package.json`](package.json)** - Project dependencies and npm scripts
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
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and ensure tests pass
4. Format and lint your code: `npm run format && npm run lint-fix`
5. Commit your changes: `git commit -am 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature`
7. Submit a pull request

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style and patterns
- Run `npm run type-check` before committing
- Test your changes in FoundryVTT
- Update documentation as needed

## 📦 Deployment

1. Build the system: `npm run build`
2. Copy the `dist/` folder to your FoundryVTT `systems/nimble/` directory
3. Restart FoundryVTT or reload the system
