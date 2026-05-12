import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";
import ListView from "./components/views/ListView";
import BoardView from "./components/views/BoardView";
import CalendarView from "./components/views/CalendarView";
import GanttView from "./components/views/GanttView";

function Login({ onLogin }: { onLogin: (token: string) => void }) {
	const [id, setId] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		try {
			const res = await fetch("/api/login", {
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
		<div className="flex items-center justify-center h-screen bg-gray-100">
			<form onSubmit={handleSubmit} className="p-8 bg-white shadow rounded-lg flex flex-col gap-4">
				<h2 className="text-xl font-bold">Login</h2>
				{error && <p className="text-red-500">{error}</p>}
				<input
					type="text"
					placeholder="User ID (e.g. sai or rups)"
					className="border p-2 rounded"
					value={id}
					onChange={(e) => setId(e.target.value)}
				/>
				<input
					type="password"
					placeholder="Password"
					className="border p-2 rounded"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
				<button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
					Login
				</button>
			</form>
		</div>
	);
}

function MainApp({ onLogout }: { onLogout: () => void }) {
	const [activeView, setActiveView] = useState("List");

	return (
		<div className="flex flex-col h-screen bg-gray-50">
			<header className="bg-white border-b p-4 flex gap-4 items-center justify-between shadow-sm">
				<div className="flex gap-4">
					{['List', 'Board', 'Calendar', 'Gantt'].map(view => (
						<button
							key={view}
							onClick={() => setActiveView(view)}
							className={`px-4 py-2 font-medium rounded transition-colors ${activeView === view ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
						>
							{view}
						</button>
					))}
				</div>
				<button onClick={onLogout} className="px-4 py-2 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50">
					Logout
				</button>
			</header>
			<div className="flex-1 overflow-auto p-4">
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
