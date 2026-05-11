import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";
import { User, PlusCircle } from "lucide-react";
import ListView from "./components/views/ListView";
import BoardView from "./components/views/BoardView";
import CalendarView from "./components/views/CalendarView";
import GanttView from "./components/views/GanttView";

function Login({ onLogin }: { onLogin: (token: string) => void }) {
	const [id, setId] = useState("");
	const [hasPassword, setHasPassword] = useState<boolean | null>(null);
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const selectUser = async (userId: string) => {
		setId(userId);
		setError("");
		try {
			const res = await fetch(`/api/auth/check?id=${userId}`);
			const data: any = await res.json();
			if (res.ok) {
				setHasPassword(data.hasPassword);
			} else {
				setError(data.error || "Failed to check user status");
			}
		} catch (e) {
			setError("An error occurred");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		try {
			const endpoint = hasPassword ? "/api/login" : "/api/auth/create";
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, password }),
			});
			if (!res.ok) {
				const data: any = await res.json();
				setError(data.error || "Login failed");
				return;
			}
			const data: any = await res.json();
			if (data.token) {
				localStorage.setItem("token", data.token);
				onLogin(data.token);
			}
		} catch (err) {
			setError("An error occurred");
		}
	};

	return (
		<div className="flex items-center justify-center h-screen bg-bg-main">
			<div className="p-8 bg-bg-card shadow rounded-lg flex flex-col gap-6 items-center border border-border w-full max-w-sm">
				<h2 className="text-2xl font-bold text-text-main">Welcome Back</h2>

				{!id ? (
					<div className="flex gap-8 justify-center w-full">
						<button onClick={() => selectUser("sai")} className="flex flex-col items-center gap-2 hover:scale-105 transition-transform">
							<div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow">
								<User size={32} />
							</div>
							<span className="font-medium text-text-main">Sai</span>
						</button>
						<button onClick={() => selectUser("rups")} className="flex flex-col items-center gap-2 hover:scale-105 transition-transform">
							<div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center shadow">
								<User size={32} />
							</div>
							<span className="font-medium text-text-main">Rups</span>
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
						<div className="flex justify-between items-center mb-2">
							<span className="font-medium text-text-main">User: <span className="capitalize">{id}</span></span>
							<button type="button" onClick={() => { setId(""); setPassword(""); setHasPassword(null); setError(""); }} className="text-sm text-accent hover:underline">Change</button>
						</div>
						{error && <p className="text-red-500 text-sm text-center">{error}</p>}

						{hasPassword !== null && (
							<>
								<label className="text-sm text-text-muted">{hasPassword ? "Enter Password" : "Create Password"}</label>
								<input
									type="password"
									placeholder="Password"
									className="border border-border bg-bg-main text-text-main p-2 rounded focus:ring-2 focus:ring-accent outline-none"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									autoFocus
								/>
								<button type="submit" className="bg-accent text-white p-2 rounded hover:bg-accent/90 transition-colors">
									{hasPassword ? "Login" : "Create Account"}
								</button>
							</>
						)}
					</form>
				)}
			</div>
		</div>
	);
}

function MainApp({ onLogout }: { onLogout: () => void }) {
	const [activeView, setActiveView] = useState("List");
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark-default");

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("theme", theme);
	}, [theme]);

	const themes = [
		{ id: 'light', name: 'Light' },
		{ id: 'dark-default', name: 'Dark Default' },
		{ id: 'dark-midnight', name: 'Midnight' },
		{ id: 'dark-purple', name: 'Purple' },
		{ id: 'dark-forest', name: 'Forest' },
		{ id: 'neon', name: 'Neon' },
		{ id: 'dark-ocean', name: 'Ocean' },
		{ id: 'dark-obsidian', name: 'Obsidian' }
	];

	return (
		<div className="flex flex-col h-screen bg-bg-main text-text-main transition-colors duration-300">
			<header className="sticky top-0 z-10 bg-bg-header backdrop-blur-md border-b border-border p-4 flex gap-4 items-center justify-between shadow-sm transition-colors duration-300">
				<div className="flex gap-2">
					{['List', 'Board', 'Calendar', 'Gantt'].map(view => (
						<button
							key={view}
							onClick={() => setActiveView(view)}
							className={`px-4 py-2 font-medium rounded transition-all duration-200 ${activeView === view ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:bg-bg-card hover:text-text-main'}`}
						>
							{view}
						</button>
					))}
				</div>
				<div className="flex items-center gap-4">
					<button onClick={() => {
						const title = prompt("Enter task title:");
						if (title) {
							fetch('/api/tasks', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
								body: JSON.stringify({ title })
							}).then(res => res.json()).then(() => {
								window.dispatchEvent(new Event('taskAdded'));
							}).catch(console.error);
						}
					}} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors shadow-sm">
						<PlusCircle size={16} />
						Add Task
					</button>
					<select
						value={theme}
						onChange={(e) => setTheme(e.target.value)}
						className="bg-bg-card text-text-main border border-border rounded p-2 outline-none focus:ring-2 focus:ring-accent transition-colors"
					>
						{themes.map(t => (
							<option key={t.id} value={t.id}>{t.name}</option>
						))}
					</select>
					<button onClick={onLogout} className="px-4 py-2 text-sm text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white transition-colors">
						Logout
					</button>
				</div>
			</header>
			<div className="flex-1 overflow-auto p-6">
				{activeView === 'List' && <ListView />}
				{activeView === 'Board' && <BoardView />}
				{activeView === 'Calendar' && <CalendarView />}
				{activeView === 'Gantt' && <GanttView />}
			</div>
		</div>
	);
}

function App() {
	const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

	const handleLogin = (newToken: string) => {
		setToken(newToken);
	};

	const handleLogout = () => {
		localStorage.removeItem("token");
		setToken(null);
	};

	if (!token) {
		return <Login onLogin={handleLogin} />;
	}

	return <MainApp onLogout={handleLogout} />;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(<App />);
