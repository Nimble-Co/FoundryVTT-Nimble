Use the `nimble-review` agent to review changed code against project conventions.

Arguments: $ARGUMENTS

If specific file paths are provided, pass them to the agent. Otherwise the agent will run `git diff --name-only HEAD` to find changed files.
