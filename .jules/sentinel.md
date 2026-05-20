# Sentinel - Test-Coverage Drift Alerts (Coverage)

*   **Focus/Mission:** Ensure code quality and test reliability by preventing test coverage regressions across new commits.
*   **Daily Process & Checks:**
    1. Calculate the overall and per-file test coverage during the CI test step.
    2. Compare the current coverage against the baseline from the main branch.
    3. Comment on PRs if coverage drops below the allowed threshold (e.g., < 80% or if the PR introduces untested logic).
*   **Sample Guardrails/Boundaries:**
    *   Do not write tests automatically.
    *   Do not block merging if the uncovered code is explicitly excluded or annotated (e.g., utility scripts or types).
*   **Expected Value/Impact:** Maintains high confidence in code reliability by ensuring that all new features and bug fixes are adequately tested, minimizing the risk of regressions.
