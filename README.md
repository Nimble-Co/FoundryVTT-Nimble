# Nimble v2 for FoundryVTT

[![License: MIT](https://img.shields.io/badge/Software_License-MIT-blue.svg)](https://mit-license.org/)
[![Discord](https://img.shields.io/discord/957965481455788032?label=Discord%20Server&logo=discord&logoColor=white)](https://discord.gg/APTKATGeJW)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?logo=patreon&logoColor=white)](https://www.patreon.com/ForgemasterModules)

An official implementation of the Nimble 2 RPG system for Foundry Virtual Tabletop, built with TypeScript and Svelte.

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

## Software License

### MIT
Copyright &#169; 2024 Nimble Co.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Content Licenses

### Nimble 3rd Party Creator License
#### Terms
You may create and publish original works based on or compatible with Nimble (the ‘System’) without Nimble Co.’s prior approval and retain all profits.
- You may use and reference this book’s text in your original products (adventures, classes, subclasses, monsters, suppleents, etc.). Copying large portions of text verbatim with little or no added value does not qualify as an original product. For additional FAQ see [nimbleRPG.com/creators](nimbleRPG.com/creators).
- You may not use the System’s art or logo but may use theNimble compatibility logo ([nimbleRPG.com/creators](nimbleRPG.com/creators)).

#### Restrictions
Your product must not appear to be an official Nimble product or endorsed by Nimble Co. We are not liable for claims related to your product, and you will not bring legal claims against us.

#### Rights Reserved
Unless explicitly stated, this license does not grant copyright, moral, publicity, privacy, patent, or trademark rights. All other rights are reserved by Nimble Co.

#### Legal Terms
You agree to indemnify Nimble Co. and its affiliates from any claims or liabilities arising from your use of the System. This license may be terminated if you violate its terms. Upon termination, you must cease distribution of your product until the violation is resolved. This license is governed by Florida law. Disputes will be resolved in the U.S. District Court for the Middle District of Florida or state courts in Orange County, Florida. If a provision of this license is unenforceable, it will be reformed or severed without affecting the rest of the license. This license does not waive Nimble Co.’s legal privileges.

#### Required Attribution
Include in your product:

> “[Product Name] is an independent product published under the Nimble 3rd Party Creator License and is not affiliated with Nimble Co. Nimble © 2025 Nimble Co.”

### System Reference Document 5.1
This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.
