const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log("Running Trim (Automated Dependency Pruner)...");
    let report = "# Trim Report\n\n";
    try {
        const output = execSync('npx depcheck --ignores="@cloudflare/*,@testing-library/*,@types/*,autoprefixer,esbuild,eslint-*,globals,jsdom,postcss,postcss-cli,prettier,tailwindcss,typescript-eslint,vite,vitest,wrangler,@dnd-kit/*,@hookform/*,@radix-ui/*,@tailwindcss/*,@tanstack/*,class-variance-authority,clsx,cmdk,date-fns,embla-carousel-react,input-otp,lucide-react,nanoid,nodemailer,partyserver,partysocket,react,react-day-picker,react-dom,react-hook-form,react-resizable-panels,react-router,recharts,sonner,tailwind-merge,tw-animate-css,vaul,vite-tsconfig-paths,zod"', { encoding: 'utf-8' });
        report += "```\n" + output + "\n```\n";
    } catch (e) {
        report += "```\n" + (e.stdout || e.message) + "\n```\n";
    }

    fs.writeFileSync('.jules/trim-report.md', report);
    console.log("Trim report generated: .jules/trim-report.md");
} catch (e) {
    console.error("Trim script failed:", e);
}
