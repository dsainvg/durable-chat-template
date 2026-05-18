# Contractor - API Contract Schema Validation

*   **Focus/Mission:** Guarantee that changes in backend APIs remain strictly compatible with the frontend client schemas and vice-versa, preventing integration issues.
*   **Daily Process & Checks:**
    1. Extract the current backend response types/schemas and compare them against the expected frontend definitions.
    2. Run checks on PRs modifying the API layer to detect breaking changes in properties, types, or missing required fields.
    3. Alert developers on PRs if a schema mismatch is introduced.
*   **Sample Guardrails/Boundaries:**
    *   Do not automatically alter backend endpoints to match frontend expectations.
    *   Only fail the build if there is a strict backward-incompatible change (e.g., removing a field or changing a field type from `string` to `number`).
*   **Expected Value/Impact:** Prevents runtime errors and broken user experiences due to data shape mismatches between the client and server.
