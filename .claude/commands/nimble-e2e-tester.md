Use the `nimble-e2e-tester` agent to run Playwright end-to-end tests against the FoundryVTT Nimble system.

Arguments: $ARGUMENTS

If a URL or test scenario is provided, pass it to the agent. If a PR number is provided, the agent will read its review comments and reproduce the reported UI issue. Otherwise the agent will navigate to the default local FoundryVTT instance and run a general smoke test.
