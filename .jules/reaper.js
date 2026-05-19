const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log("Running Reaper (Dead-Code Detector)...");
    let report = "# Reaper Report\n\n";
    try {
        const output = execSync('npx ts-prune', { encoding: 'utf-8' });
        report += "```\n" + output + "\n```\n";
    } catch (e) {
        report += "```\n" + (e.stdout || e.message) + "\n```\n";
    }

    fs.writeFileSync('.jules/reaper-report.md', report);
    console.log("Reaper report generated: .jules/reaper-report.md");
} catch (e) {
    console.error("Reaper script failed:", e);
}
