---
name: skill-creator
description: "Project-level override for the global skill-creator. Enforces directory structure for all new skills in this project."
---

## Project Requirement: Directory Structure

For this project, **all skills MUST use the directory structure**. Never create a flat `.md` skill file.

```
.claude/skills/skill-name/
├── SKILL.md          (required — the main skill content)
├── scripts/          (always create; add README.md placeholder if no scripts yet)
├── references/       (always create; add README.md placeholder if no references yet)
└── assets/           (always create; add README.md placeholder if no assets yet)
```

### Rules

1. **Never create** a flat `.claude/skills/skill-name.md` file — always create the directory with subdirs.
2. **Always create** all 3 subdirectories (`scripts/`, `references/`, `assets/`) even if they start empty (add a `README.md` placeholder).
3. **Extract reusable content** into the appropriate subdir:
   - Bash/JS/Python snippets → `scripts/`
   - Tables, checklists, reference docs → `references/`
   - Screenshots, diagrams → `assets/`
4. When running the global skill-creator workflow, apply this structure from the start.

### Placeholders

For empty subdirs, use this placeholder pattern:
```markdown
# Scripts  (or References / Assets)

Add [scripts/references/assets] here as the skill grows.
```
