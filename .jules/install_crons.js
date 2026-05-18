const fs = require('fs');

const file = 'wrangler.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data.triggers) {
    data.triggers = { crons: [] };
}
if (!data.triggers.crons) {
    data.triggers.crons = [];
}

// Add our daily check cron at midnight if not present
if (!data.triggers.crons.includes("0 0 * * *")) {
    data.triggers.crons.push("0 0 * * *");
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log("Added 0 0 * * * to wrangler.json crons.");
} else {
    console.log("Cron already exists.");
}
