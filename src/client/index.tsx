import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";
import ListView from "./components/views/ListView";
import BoardView from "./components/views/BoardView";
import CalendarView from "./components/views/CalendarView";
import GanttView from "./components/views/GanttView";

function Login({ onLogin }: { onLogin: (token: string) => void }) {
	const [selectedUser, setSelectedUser] = useState<string | null>(null);
	const [needsPassword, setNeedsPassword] = useState(false);
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleSelectUser = async (user: string) => {
		setError("");
		setSelectedUser(user);
		try {
			const res = await fetch(`/api/user/${user}`);
			const data: any = await res.json();
			setNeedsPassword(!data.exists);
		} catch (e) {
			setError("Failed to check user status");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!selectedUser) return;

		if (needsPassword) {
			try {
				const res = await fetch(`/api/user/${selectedUser}/password`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ password }),
				});
				if (!res.ok) {
					const data: any = await res.json();
					setError(data.error || "Failed to create password");
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
		} else {
			try {
				const res = await fetch("/api/login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id: selectedUser, password }),
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
		}
	};

	if (!selectedUser) {
		return (
			<div className="flex items-center justify-center h-screen bg-[var(--bg-main)]">
				<div className="p-8 bg-[var(--bg-card)] shadow-xl rounded-2xl flex flex-col items-center gap-6 border border-[var(--border-color)]">
					<h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Select User</h2>
					<div className="flex gap-8">
						<button onClick={() => handleSelectUser('sai')} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-[var(--accent-light)] transition-colors border border-transparent hover:border-[var(--accent)] group">
							<div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold group-hover:scale-110 transition-transform shadow">S</div>
							<span className="font-semibold text-[var(--text-main)]">Sai</span>
						</button>
						<button onClick={() => handleSelectUser('rups')} className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-[var(--accent-light)] transition-colors border border-transparent hover:border-[var(--accent)] group">
							<div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-2xl font-bold group-hover:scale-110 transition-transform shadow">R</div>
							<span className="font-semibold text-[var(--text-main)]">Rups</span>
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-center h-screen bg-[var(--bg-main)]">
			<form onSubmit={handleSubmit} className="p-8 bg-[var(--bg-card)] shadow-xl rounded-2xl flex flex-col gap-5 border border-[var(--border-color)] w-full max-w-sm relative">
				<button type="button" onClick={() => setSelectedUser(null)} className="absolute top-4 left-4 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]">← Back</button>
				<div className="flex flex-col items-center mt-4">
					<div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3 shadow ${selectedUser === 'sai' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
						{selectedUser === 'sai' ? 'S' : 'R'}
					</div>
					<h2 className="text-xl font-bold text-[var(--text-main)] capitalize">{selectedUser}</h2>
					<p className="text-sm text-[var(--text-muted)] mt-1">{needsPassword ? 'Create a new password' : 'Enter your password'}</p>
				</div>
				{error && <p className="text-red-500 text-sm text-center">{error}</p>}
				<input
					type="password"
					placeholder="Password"
					className="border border-[var(--border-color)] p-3 rounded-lg bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					autoFocus
				/>
				<button type="submit" className="bg-[var(--accent)] text-white p-3 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md">
					{needsPassword ? 'Create & Login' : 'Login'}
				</button>
			</form>
		</div>
	);
}

function MainApp({ onLogout }: { onLogout: () => void }) {
	const [activeView, setActiveView] = useState("List");
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [spaces, setSpaces] = useState<{id: number, name: string}[]>([]);
	const [activeSpaceId, setActiveSpaceId] = useState<number>(1);
	const [newSpaceName, setNewSpaceName] = useState("");

	useEffect(() => {
		fetch('/api/spaces', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
			.then(res => res.json())
			.then(data => { if (Array.isArray(data)) setSpaces(data); })
			.catch(console.error);
	}, []);

	const handleAddSpace = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newSpaceName.trim()) return;
		try {
			await fetch('/api/spaces', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
				body: JSON.stringify({ name: newSpaceName })
			});
			setNewSpaceName("");
			const res = await fetch('/api/spaces', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
			const data = await res.json();
			if (Array.isArray(data)) setSpaces(data);
		} catch (e) { console.error(e); }
	};


	const [showTaskModal, setShowTaskModal] = useState(false);
	const [templates, setTemplates] = useState<{id: number, name: string, default_status: string, default_type: string, duration: number}[]>([]);
	const [newTaskTitle, setNewTaskTitle] = useState("New Task");
	const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");

	useEffect(() => {
		fetch('/api/templates', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
			.then(res => res.json())
			.then(data => { if (Array.isArray(data)) setTemplates(data); })
			.catch(console.error);
	}, []);

	const submitNewTask = async (e: React.FormEvent) => {
		e.preventDefault();
		const template = templates.find(t => t.id === selectedTemplateId);
		try {
			await fetch('/api/tasks', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${localStorage.getItem('token')}`
				},
				body: JSON.stringify({
					title: newTaskTitle,
					space_id: activeSpaceId,
					status: template?.default_status || 'To Do',
					task_type: template?.default_type || 'Task',
					duration: template?.duration || 1
				})
			});
			setRefreshTrigger(prev => prev + 1);
			setShowTaskModal(false);
			setNewTaskTitle("New Task");
			setSelectedTemplateId("");
		} catch (e) {
			console.error("Failed to add task", e);
		}
	};


	return (
		<div className="flex h-screen bg-[var(--bg-main)]">
			{/* Sidebar */}
			<div className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col">
				<div className="p-4 border-b border-[var(--border-color)] font-bold text-[var(--text-sidebar)]">
					Spaces
				</div>
				<div className="flex-1 overflow-auto p-2">
					{spaces.map(space => (
						<button
							key={space.id}
							onClick={() => setActiveSpaceId(space.id)}
							className={`w-full text-left px-3 py-2 rounded mb-1 ${activeSpaceId === space.id ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]'}`}
						>
							{space.name}
						</button>
					))}
				</div>
				<form onSubmit={handleAddSpace} className="p-4 border-t border-[var(--border-color)]">
					<input
						type="text"
						placeholder="New Space"
						value={newSpaceName}
						onChange={(e) => setNewSpaceName(e.target.value)}
						className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--text-main)] focus:outline-none"
					/>
				</form>
			</div>

			{/* Main Content */}
			<div className="flex flex-col flex-1">
				<header className="bg-[var(--bg-header)] border-b border-[var(--border-color)] p-4 flex gap-4 items-center justify-between shadow-sm">
					<div className="flex gap-4">
						{['List', 'Board', 'Calendar', 'Gantt'].map(view => (
							<button
								key={view}
								onClick={() => setActiveView(view)}
								className={`px-4 py-2 font-medium rounded transition-colors ${activeView === view ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]'}`}
							>
								{view}
							</button>
						))}
					</div>
					<div className="flex items-center gap-4">
						<select
							className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] rounded p-1 text-sm focus:outline-none"
							onChange={(e) => document.documentElement.setAttribute('data-theme', e.target.value)}
							defaultValue="default"
						>
							<option value="default">Light</option>
							<option value="dark-default">Dark Default</option>
							<option value="dark-midnight">Dark Midnight</option>
							<option value="dark-purple">Dark Purple</option>
							<option value="dark-forest">Dark Forest</option>
							<option value="neon">Neon</option>
						</select>
						<button onClick={() => setShowTaskModal(true)} className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity">
							+ Add Task
						</button>
						<button onClick={onLogout} className="px-4 py-2 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50">
							Logout
						</button>
					</div>
				</header>
				<div className="flex-1 overflow-auto p-4">
					{activeView === 'List' && <ListView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Board' && <BoardView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Calendar' && <CalendarView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Gantt' && <GanttView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
				</div>

			{showTaskModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<form onSubmit={submitNewTask} className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 rounded-lg shadow-xl w-96 flex flex-col gap-4">
						<h2 className="text-xl font-bold text-[var(--text-main)]">Add New Task</h2>
						<div>
							<label className="block text-sm text-[var(--text-muted)] mb-1">Task Title</label>
							<input
								type="text"
								value={newTaskTitle}
								onChange={e => setNewTaskTitle(e.target.value)}
								className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
								required
							/>
						</div>
						<div>
							<label className="block text-sm text-[var(--text-muted)] mb-1">Use Template (Optional)</label>
							<select
								value={selectedTemplateId}
								onChange={e => setSelectedTemplateId(e.target.value ? Number(e.target.value) : "")}
								className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
							>
								<option value="">-- No Template --</option>
								{templates.map(t => (
									<option key={t.id} value={t.id}>{t.name}</option>
								))}
							</select>
						</div>
						<div className="flex justify-end gap-2 mt-4">
							<button type="button" onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">Cancel</button>
							<button type="submit" className="px-4 py-2 bg-[var(--accent)] text-white rounded hover:opacity-90">Add Task</button>
						</div>
					</form>
				</div>
			)}
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
