# Automation Pipeline & AI Agent Ideas

This document outlines potential automation capabilities and AI agents that can be introduced to enhance our workflow without modifying core application code.

## 1. Security Vulnerability Scanner (Agent 'Shield')

*   **Focus/Mission**: Continuously monitor dependencies and configuration files to identify and report known security vulnerabilities before they hit production.
*   **Daily Process & Checks**:
    *   Run `npm audit` or `pnpm audit` on the lockfile.
    *   Scan for hardcoded secrets or credentials in the codebase using tools like `trufflehog` or `git-secrets`.
    *   Analyze `wrangler.json` and other configuration files for insecure settings.
*   **Sample Guardrails/Boundaries**:
    *   Never auto-commit major version dependency updates.
    *   Do not automatically rotate live secrets; instead, alert the team.
    *   Never modify the source code directly; output reports and create warning PRs or issues.
*   **Expected Value/Impact**: Prevents injection of known vulnerabilities, ensuring our Cloudflare Workers and React frontend remain secure.

## 2. Test-Coverage Drift Monitor (Agent 'Coverage')

*   **Focus/Mission**: Prevent the erosion of test coverage as new features are added by tracking metrics across commits.
*   **Daily Process & Checks**:
    *   Run `vitest run --coverage` and extract code coverage metrics (lines, branches, functions).
    *   Compare current branch coverage against the `main` branch baseline.
    *   Fail the check if the coverage drops by more than a configurable threshold (e.g., 2%).
*   **Sample Guardrails/Boundaries**:
    *   Do not enforce 100% coverage; allow for acceptable thresholds and exclusions.
    *   Never write or modify tests autonomously; strictly a reporting tool.
*   **Expected Value/Impact**: Ensures the team maintains high code quality and reliability standards, minimizing unverified code paths.

## 3. Dead-Code Detector (Agent 'Reaper')

*   **Focus/Mission**: Keep the codebase clean and bundle sizes small by identifying unused exports, components, and CSS classes.
*   **Daily Process & Checks**:
    *   Execute static analysis using tools like `knip` or `ts-prune` to find unused files and exports.
    *   Cross-reference TanStack Router definitions to find orphaned routes or components.
    *   Check for unused Tailwind classes or CSS variables.
*   **Sample Guardrails/Boundaries**:
    *   Never delete code automatically; only generate reports or PRs with suggested deletions.
    *   Ignore dynamically imported modules or files prefixed with specific comments.
*   **Expected Value/Impact**: Reduces technical debt, decreases build times, and shrinks the frontend bundle size for better performance.

## 4. API Contract Schema Validator (Agent 'Contract')

*   **Focus/Mission**: Ensure that changes to the backend API do not break existing frontend expectations or external integrations.
*   **Daily Process & Checks**:
    *   Parse Zod schemas used in the Cloudflare Worker and compare them against frontend types.
    *   Run contract tests (if any) against a local `wrangler dev` instance.
    *   Validate that payload structures for WebSocket (PartyKit) messages remain backward compatible.
*   **Sample Guardrails/Boundaries**:
    *   Never alter Zod schemas to bypass failures.
    *   Do not block development builds; only fail PR checks if breaking changes are detected without a version bump.
*   **Expected Value/Impact**: Prevents runtime errors caused by mismatched data expectations between the frontend client and backend worker.

## 5. Automated Dependency Pruner (Agent 'Trim')

*   **Focus/Mission**: Keep the project dependencies up-to-date and remove bloat by finding and removing unused or obsolete packages.
*   **Daily Process & Checks**:
    *   Analyze `package.json` against actual import statements in the `src/` directory.
    *   Check for updates to minor and patch versions of existing dependencies.
    *   Generate a weekly summary of packages that could be safely removed or updated.
*   **Sample Guardrails/Boundaries**:
    *   Do not auto-uninstall packages; some dependencies might be required at runtime (e.g., specific Vite plugins or Cloudflare bindings).
    *   Do not mix major dependency updates with routine pruning.
*   **Expected Value/Impact**: Improves installation speed, reduces the attack surface, and keeps the project aligned with the latest stable library versions.
