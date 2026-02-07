# Release Guide

Instructions for creating GitHub Releases for the Nimble FoundryVTT system.

## Creating a Release

### 1. Gather Changes

Get all commits since the last release tag:

```bash
git log <previous-tag>..HEAD --pretty=format:"%s|%an" --reverse
```

### 2. Categorize Changes

Group commits into these categories:

- **Additions / Changes** - New features, improvements, or behavior changes
- **Fixes** - Bug fixes and corrections
- **System Data** - Compendium packs, data, or content corrections

### 3. Format

Each entry should follow this format:
```
- [#<issue>] <Brief description>. @<contributor>
```

- Issue/PR number first in brackets (creates clickable link on GitHub)
- Use sentence case for description
- Credit the contributor with @username at the end

### 4. Release Notes Template

```markdown
## Version X.Y.Z

### Additions / Changes

- [#123] Description of feature or change. @contributor

### Fixes

- [#124] Description of fix. @contributor

### System Data

- [#125] Description of compendium/pack update. @contributor

---

If you want to support further system development, please consider joining or tipping one of the contributors on their Patreon or Ko-fi page.
```

### 5. Update CHANGELOG.md

Add a new section at the top of CHANGELOG.md using **Keep a Changelog** format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- [#123] Description of feature. @contributor

### Fixed

- [#124] Description of fix. @contributor

### Changed

- [#125] Description of change. @contributor

---
```

Note: CHANGELOG.md uses different categories than GitHub Releases:
| GitHub Release | CHANGELOG.md |
|----------------|--------------|
| Additions / Changes | Added |
| Fixes | Fixed |
| System Data | Changed |

### 6. Create GitHub Release

```bash
gh release create X.Y.Z --title "VX.Y.Z" --notes-file <release-notes-file>
```

Or create via GitHub UI at: https://github.com/FoundryVTT-NimbleDev/FoundryVTT-Nimble/releases/new

## Version Numbering

Follow semantic versioning:
- **Major (X)**: Breaking changes
- **Minor (Y)**: New features, backward compatible
- **Patch (Z)**: Bug fixes, backward compatible
