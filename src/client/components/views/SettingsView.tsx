import React, { useEffect, useState } from "react";

export default function SettingsView() {
	const [theme, setTheme] = useState(localStorage.getItem('theme') || 'default');

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}, [theme]);

	return (
		<div className="bg-[var(--bg-card)] shadow rounded-lg border border-[var(--border-color)] p-6 max-w-2xl mx-auto mt-8">
			<h2 className="text-2xl font-bold text-[var(--text-main)] mb-6 border-b border-[var(--border-color)] pb-4">Settings</h2>

			<div className="flex flex-col gap-6">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold text-[var(--text-main)]">Theme Preferences</h3>
						<p className="text-sm text-[var(--text-muted)]">Select your preferred application theme.</p>
					</div>
					<select
						className="bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:border-[var(--accent)]"
						value={theme}
						onChange={(e) => setTheme(e.target.value)}
					>
						<option value="default">Light</option>
						<option value="dark-default">Dark Default</option>
						<option value="dark-midnight">Dark Midnight</option>
						<option value="dark-purple">Dark Purple</option>
						<option value="dark-forest">Dark Forest</option>
						<option value="neon">Neon</option>
					</select>
				</div>
			</div>
		</div>
	);
}
