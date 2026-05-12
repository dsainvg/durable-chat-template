import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";
import ListView from "./components/views/ListView";
import BoardView from "./components/views/BoardView";
import CalendarView from "./components/views/CalendarView";
import GanttView from "./components/views/GanttView";
import ChatView from "./components/views/ChatView";
import SettingsView from "./components/views/SettingsView";
import usePartySocket from "partysocket/react";

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
	const [spacesOpen, setSpacesOpen] = useState(true);
	const [usersStatus, setUsersStatus] = useState<any[]>([]);

	// Setup task update listener
	usePartySocket({
		room: activeSpaceId.toString(),
		party: "chat",
		onMessage(evt) {
			try {
				const data = JSON.parse(evt.data);
				if (data.type === "task_updated") {
					setRefreshTrigger(prev => prev + 1);
				}
			} catch(e) {}
		}
	});

	useEffect(() => {
		const updateActiveView = () => {
			const savedView = localStorage.getItem(`activeView_${activeSpaceId}`);
			if (savedView && savedView !== "Settings") {
				setActiveView(savedView);
			} else {
				setActiveView("List");
			}
		};
		updateActiveView();
	}, [activeSpaceId]);

	const handleSetView = (view: string) => {
		setActiveView(view);
		if (view !== "Settings") {
			localStorage.setItem(`activeView_${activeSpaceId}`, view);
		}
	};

	useEffect(() => {
		const pollUserStatus = async () => {
			try {
				const token = localStorage.getItem('token');
				if (!token) return;

				// Heartbeat and get status combined
				const res = await fetch('/api/heartbeat', {
					method: 'POST',
					headers: { 'Authorization': `Bearer ${token}` }
				});

				const data = await res.json();
				if (Array.isArray(data)) {
					setUsersStatus(data);
				}
			} catch (e) {}
		};
		pollUserStatus();
		const interval = setInterval(pollUserStatus, 10000);
		return () => clearInterval(interval);
	}, []);

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
	const [newTaskStatus, setNewTaskStatus] = useState("To Do");
	const [newTaskType, setNewTaskType] = useState("Task");
	const [newTaskCustomId, setNewTaskCustomId] = useState("");
	const [newTaskDueDate, setNewTaskDueDate] = useState("");
	const [newTaskStart, setNewTaskStart] = useState<number>(1);
	const [newTaskDuration, setNewTaskDuration] = useState<number>(1);

	const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");

	useEffect(() => {
		fetch('/api/templates', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
			.then(res => res.json())
			.then(data => { if (Array.isArray(data)) setTemplates(data); })
			.catch(console.error);
	}, []);

	const handleTemplateChange = (id: number | "") => {
		setSelectedTemplateId(id);
		const template = templates.find(t => t.id === id);
		if (template) {
			setNewTaskStatus(template.default_status || "To Do");
			setNewTaskType(template.default_type || "Task");
			setNewTaskDuration(template.duration || 1);
		}
	};

	const submitNewTask = async (e: React.FormEvent) => {
		e.preventDefault();
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
					status: newTaskStatus,
					task_type: newTaskType,
					custom_task_id: newTaskCustomId || undefined,
					due_date: newTaskDueDate || undefined,
					start: newTaskStart,
					duration: newTaskDuration
				})
			});
			setRefreshTrigger(prev => prev + 1);
			setShowTaskModal(false);

			// Reset fields
			setNewTaskTitle("New Task");
			setNewTaskStatus("To Do");
			setNewTaskType("Task");
			setNewTaskCustomId("");
			setNewTaskDueDate("");
			setNewTaskStart(1);
			setNewTaskDuration(1);
			setSelectedTemplateId("");
		} catch (e) {
			console.error("Failed to add task", e);
		}
	};


	return (
		<div className="flex h-screen bg-[var(--bg-main)]">
			{/* Sidebar */}
			<div className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col p-4">
				<button onClick={() => setShowTaskModal(true)} className="w-full px-4 py-2 mb-6 text-sm bg-[var(--accent)] text-white rounded font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
					Add Task
				</button>

				<div className="flex items-center justify-between font-bold text-[var(--text-sidebar)] mb-2 px-2">
					<span>Spaces</span>
					<button onClick={() => setSpacesOpen(!spacesOpen)} className="text-[var(--text-muted)] hover:text-[var(--text-sidebar)]">
						{spacesOpen ? '▼' : '▶'}
					</button>
				</div>

				{spacesOpen && (
					<div className="flex flex-col gap-1 mb-4 overflow-y-auto max-h-60">
						{spaces.map(space => (
							<button
								key={space.id}
								onClick={() => setActiveSpaceId(space.id)}
								className={`w-full text-left px-3 py-2 rounded text-sm ${activeSpaceId === space.id && activeView !== 'Settings' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]'}`}
							>
								# {space.name}
							</button>
						))}
						<form onSubmit={handleAddSpace} className="mt-2">
							<input
								type="text"
								placeholder="+ New Space"
								value={newSpaceName}
								onChange={(e) => setNewSpaceName(e.target.value)}
								className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none"
							/>
						</form>
					</div>
				)}

				<div className="mt-auto flex flex-col gap-1 pt-4 border-t border-[var(--border-color)]">
					{usersStatus.map((u: any) => (
						<div key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-sidebar)]">
							<div className={`w-2 h-2 rounded-full ${u.active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
							<span className="capitalize">{u.id}</span> {u.active ? '(Online)' : ''}
						</div>
					))}

					<button onClick={() => handleSetView('Settings')} className={`w-full text-left px-3 py-2 rounded text-sm mt-4 ${activeView === 'Settings' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]'}`}>
						⚙️ Settings
					</button>
					<button onClick={onLogout} className="w-full text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
						🚪 Logout
					</button>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex flex-col flex-1 bg-[var(--bg-main)]">
				{activeView !== "Settings" && (
					<header className="bg-[var(--bg-header)] border-b border-[var(--border-color)] p-4 flex gap-4 items-center justify-between shadow-sm">
						<div className="flex gap-4">
							{['List', 'Board', 'Calendar', 'Gantt', 'Chat'].map(view => (
								<button
									key={view}
									onClick={() => handleSetView(view)}
									className={`px-4 py-2 text-sm font-medium rounded transition-colors ${activeView === view ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]'}`}
								>
									{view}
								</button>
							))}
						</div>
						<div className="text-[var(--text-main)] font-semibold px-4">
							{spaces.find(s => s.id === activeSpaceId)?.name || ''}
						</div>
					</header>
				)}

				<div className="flex-1 overflow-auto p-4">
					{activeView === 'List' && <ListView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Board' && <BoardView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Calendar' && <CalendarView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Gantt' && <GanttView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Chat' && <ChatView refreshTrigger={refreshTrigger} activeSpaceId={activeSpaceId} />}
					{activeView === 'Settings' && <SettingsView />}
				</div>

			{showTaskModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<form onSubmit={submitNewTask} className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 rounded-lg shadow-xl w-[32rem] max-h-[90vh] overflow-y-auto flex flex-col gap-4">
						<h2 className="text-xl font-bold text-[var(--text-main)] sticky top-0 bg-[var(--bg-card)] pt-2 pb-4 z-10">Add New Task</h2>

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
								onChange={e => handleTemplateChange(e.target.value ? Number(e.target.value) : "")}
								className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
							>
								<option value="">-- No Template --</option>
								{templates.map(t => (
									<option key={t.id} value={t.id}>{t.name}</option>
								))}
							</select>
						</div>

						<div className="flex gap-4">
							<div className="flex-1">
								<label className="block text-sm text-[var(--text-muted)] mb-1">Status</label>
								<select
									value={newTaskStatus}
									onChange={e => setNewTaskStatus(e.target.value)}
									className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
								>
									<option value="To Do">To Do</option>
									<option value="In Progress">In Progress</option>
									<option value="Done">Done</option>
								</select>
							</div>
							<div className="flex-1">
								<label className="block text-sm text-[var(--text-muted)] mb-1">Task Type</label>
								<select
									value={newTaskType}
									onChange={e => setNewTaskType(e.target.value)}
									className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
								>
									<option value="Task">Task</option>
									<option value="Bug">Bug</option>
									<option value="Feature">Feature</option>
								</select>
							</div>
						</div>

						<div className="flex gap-4">
							<div className="flex-1">
								<label className="block text-sm text-[var(--text-muted)] mb-1">Custom Task ID</label>
								<input
									type="text"
									value={newTaskCustomId}
									onChange={e => setNewTaskCustomId(e.target.value)}
									placeholder="e.g. ENG-123"
									className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
								/>
							</div>
							<div className="flex-1">
								<label className="block text-sm text-[var(--text-muted)] mb-1">Due Date</label>
								<input
									type="date"
									value={newTaskDueDate}
									onChange={e => setNewTaskDueDate(e.target.value)}
									className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
								/>
							</div>
						</div>

						<div className="flex gap-4">
							<div className="flex-1">
								<label className="block text-sm text-[var(--text-muted)] mb-1">Start (Gantt)</label>
								<input
									type="number"
									min="1"
									value={newTaskStart}
									onChange={e => setNewTaskStart(Number(e.target.value))}
									className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
								/>
							</div>
							<div className="flex-1">
								<label className="block text-sm text-[var(--text-muted)] mb-1">Duration (Gantt)</label>
								<input
									type="number"
									min="1"
									value={newTaskDuration}
									onChange={e => setNewTaskDuration(Number(e.target.value))}
									className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-main)] focus:outline-none"
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2 mt-4 sticky bottom-0 bg-[var(--bg-card)] pt-4 pb-2 z-10 border-t border-[var(--border-color)]">
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
