const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log("Running Coverage (Test-Coverage Drift Monitor)...");
    let report = "# Coverage Report\n\n";
    try {
        const output = execSync('npx vitest run --coverage', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
        report += "```\n" + output + "\n```\n";
    } catch (e) {
        report += "```\n" + (e.stdout || e.message) + "\n```\n";
    }

    fs.writeFileSync('.jules/coverage-report.md', report);
    console.log("Coverage report generated: .jules/coverage-report.md");
} catch (e) {
    console.error("Coverage script failed:", e);
}
