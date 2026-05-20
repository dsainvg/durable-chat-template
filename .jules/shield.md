# Shield - Security Vulnerability Scanning

*   **Focus/Mission:** Continuously guard the repository against known security vulnerabilities in both application dependencies and external container/system environments.
*   **Daily Process & Checks:**
    1. Run nightly or post-commit dependency scans (e.g., using `npm audit`, Dependabot, or Snyk).
    2. Check for outdated packages with known CVEs.
    3. Generate a report of vulnerable dependencies and create an automated PR with patches.
*   **Sample Guardrails/Boundaries:**
    *   Do not automatically merge PRs for major version bumps to avoid breaking changes.
    *   Do not modify application source code, only `package.json` or lock files.
    *   Never downgrade dependencies to resolve conflicts.
*   **Expected Value/Impact:** Ensures the application remains secure against known exploits, reducing technical debt related to outdated packages and avoiding potential security breaches.
