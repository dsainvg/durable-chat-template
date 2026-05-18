# Pruner - Automated Dependency Pruning (Trim)

*   **Focus/Mission:** Identify and remove unused or redundant dependencies to reduce the application bundle size, installation time, and attack surface.
*   **Daily Process & Checks:**
    1. Run tools like `depcheck` or custom scripts to scan for declared dependencies in `package.json` that are not imported in the source code.
    2. Review lock files for duplicate transitive dependencies.
    3. Suggest dependency removals or consolidations via PR.
*   **Sample Guardrails/Boundaries:**
    *   Must verify that the app still compiles and passes tests before creating the PR.
    *   Avoid removing packages that are dynamically imported or used implicitly (e.g., global polyfills or build-only tools).
*   **Expected Value/Impact:** Decreases application build times, reduces bundle size, and lowers maintenance overhead by keeping the project lean.
