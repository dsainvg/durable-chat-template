const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log("Running Shield (Security Vulnerability Scanner)...");
    let report = "# Shield Report\n\n## NPM Audit\n\n";
    try {
        const auditOutput = execSync('npm audit --audit-level=high', { encoding: 'utf-8' });
        report += "```\n" + auditOutput + "\n```\n";
    } catch (e) {
        report += "```\n" + (e.stdout || e.message) + "\n```\n";
    }

    report += "\n## Secrets Scan\n\n";
    try {
        const truffleOutput = execSync('npx trufflehog filesystem . --fail', { encoding: 'utf-8' });
        report += "```\n" + truffleOutput + "\n```\n";
    } catch (e) {
        report += "```\n" + (e.stdout || e.message) + "\n```\n";
    }

    fs.writeFileSync('.jules/shield-report.md', report);
    console.log("Shield report generated: .jules/shield-report.md");
} catch (e) {
    console.error("Shield script failed:", e);
}
