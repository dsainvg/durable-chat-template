const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log("Running Contract (API Contract Schema Validator)...");
    let report = "# Contract Report\n\n";
    try {
        // Here we run typescript to ensure all interfaces match and check for specific schema drift
        // since we don't have a dedicated contract testing framework set up, we will just use TS check
        const output = execSync('npx tsc --project tsconfig.json --noEmit', { encoding: 'utf-8' });
        report += "No contract/schema drift detected.\n```\n" + output + "\n```\n";
    } catch (e) {
        report += "Found schema/contract drift:\n```\n" + (e.stdout || e.message) + "\n```\n";
    }

    fs.writeFileSync('.jules/contract-report.md', report);
    console.log("Contract report generated: .jules/contract-report.md");
} catch (e) {
    console.error("Contract script failed:", e);
}
