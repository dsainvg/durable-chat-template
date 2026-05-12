import React, { useState, useEffect } from "react";

export default function SettingsView() {
	const [theme, setTheme] = useState("default");
	const [defaultView, setDefaultView] = useState("List");
	const [compactMode, setCompactMode] = useState(false);
	const [showCompleted, setShowCompleted] = useState(true);
	const [language, setLanguage] = useState("en");

	useEffect(() => {
		const storedTheme = localStorage.getItem("theme") || "default";
		const storedDefaultView = localStorage.getItem("defaultView") || "List";
		const storedCompactMode = localStorage.getItem("compactMode") === "true";
		const storedShowCompleted = localStorage.getItem("showCompleted") !== "false";
		const storedLanguage = localStorage.getItem("language") || "en";

		setTheme(storedTheme);
		setDefaultView(storedDefaultView);
		setCompactMode(storedCompactMode);
		setShowCompleted(storedShowCompleted);
		setLanguage(storedLanguage);
	}, []);

	const handleThemeChange = (newTheme: string) => {
		setTheme(newTheme);
		localStorage.setItem("theme", newTheme);
		document.documentElement.setAttribute("data-theme", newTheme);
	};

	const handleDefaultViewChange = (newView: string) => {
		setDefaultView(newView);
		localStorage.setItem("defaultView", newView);
	};

	const handleCompactModeChange = (enabled: boolean) => {
		setCompactMode(enabled);
		localStorage.setItem("compactMode", String(enabled));
		if (enabled) {
			document.body.classList.add("compact-mode");
		} else {
			document.body.classList.remove("compact-mode");
		}
	};

	const handleShowCompletedChange = (enabled: boolean) => {
		setShowCompleted(enabled);
		localStorage.setItem("showCompleted", String(enabled));
	};

	const handleLanguageChange = (newLanguage: string) => {
		setLanguage(newLanguage);
		localStorage.setItem("language", newLanguage);
	};

	return (
		<div className="bg-[var(--bg-card)] p-6 rounded-lg shadow-sm border border-[var(--border-color)] max-w-2xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 text-[var(--text-main)]">Settings</h2>

			<div className="space-y-6">
				{/* Theme Setting */}
				<div className="flex flex-col gap-2">
					<label className="font-medium text-[var(--text-main)]">Theme</label>
					<select
						value={theme}
						onChange={(e) => handleThemeChange(e.target.value)}
						className="bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
					>
						<option value="default">Light</option>
						<option value="dark-default">Dark Default</option>
						<option value="dark-midnight">Dark Midnight</option>
						<option value="dark-purple">Dark Purple</option>
						<option value="dark-forest">Dark Forest</option>
						<option value="neon">Neon</option>
					</select>
					<p className="text-sm text-[var(--text-muted)]">Choose the visual theme for the application.</p>
				</div>

				{/* Default View Setting */}
				<div className="flex flex-col gap-2">
					<label className="font-medium text-[var(--text-main)]">Default View</label>
					<select
						value={defaultView}
						onChange={(e) => handleDefaultViewChange(e.target.value)}
						className="bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
					>
						<option value="List">List</option>
						<option value="Board">Board</option>
						<option value="Calendar">Calendar</option>
						<option value="Gantt">Gantt</option>
					</select>
					<p className="text-sm text-[var(--text-muted)]">Select which view to show when you log in.</p>
				</div>

				{/* Language Setting */}
				<div className="flex flex-col gap-2">
					<label className="font-medium text-[var(--text-main)]">Language</label>
					<select
						value={language}
						onChange={(e) => handleLanguageChange(e.target.value)}
						className="bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
					>
						<option value="en">English</option>
						<option value="es">Español</option>
						<option value="fr">Français</option>
						<option value="de">Deutsch</option>
					</select>
					<p className="text-sm text-[var(--text-muted)]">Select your preferred language.</p>
				</div>

				{/* Toggle Settings */}
				<div className="pt-4 border-t border-[var(--border-color)] space-y-4">
					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={compactMode}
							onChange={(e) => handleCompactModeChange(e.target.checked)}
							className="w-5 h-5 accent-[var(--accent)] rounded"
						/>
						<span className="font-medium text-[var(--text-main)]">Compact Mode</span>
					</label>
					<p className="text-sm text-[var(--text-muted)] pl-8 -mt-2">Reduce padding and margins to fit more content on screen.</p>

					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={showCompleted}
							onChange={(e) => handleShowCompletedChange(e.target.checked)}
							className="w-5 h-5 accent-[var(--accent)] rounded"
						/>
						<span className="font-medium text-[var(--text-main)]">Show Completed Tasks</span>
					</label>
					<p className="text-sm text-[var(--text-muted)] pl-8 -mt-2">Display tasks that have been marked as Done.</p>
				</div>
			</div>
		</div>
	);
}
