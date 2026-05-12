import React, { useState, useEffect, useRef } from "react";
import usePartySocket from "partysocket/react";
import { nanoid } from "nanoid";

export default function ChatView({ activeSpaceId, refreshTrigger }: { activeSpaceId: number, refreshTrigger?: number }) {
	const [messages, setMessages] = useState<any[]>([]);
	const [input, setInput] = useState("");
	const [currentUser, setCurrentUser] = useState<string>("Unknown");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		try {
			const token = localStorage.getItem("token");
			if (token) {
				const decoded = atob(token);
				const [id] = decoded.split(':');
				setCurrentUser(id);
			}
		} catch (e) {}
	}, []);

	const socket = usePartySocket({
		room: activeSpaceId.toString(),
		party: "chat",
		onMessage(evt) {
			const data = JSON.parse(evt.data);
			if (data.type === "all") {
				setMessages(data.messages);
			} else if (data.type === "add") {
				setMessages((prev) => [...prev, data]);
			}
		},
	});

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const sendMessage = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		const newMsg = {
			type: "add",
			id: nanoid(),
			content: input,
			user: currentUser,
			role: "user"
		};

		socket.send(JSON.stringify(newMsg));
		setInput("");
	};

	return (
		<div className="flex flex-col h-full bg-[var(--bg-card)] rounded-lg shadow border border-[var(--border-color)] overflow-hidden">
			<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
				{messages.map((msg) => (
					<div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.user === currentUser ? 'self-end items-end' : 'self-start items-start'}`}>
						<span className="text-xs text-[var(--text-muted)] mb-1">{msg.user}</span>
						<div className={`px-4 py-2 rounded-xl shadow-sm ${msg.user === currentUser ? 'bg-[var(--accent)] text-white rounded-br-none' : 'bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-bl-none'}`}>
							{msg.content}
						</div>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<form onSubmit={sendMessage} className="p-4 bg-[var(--bg-main)] border-t border-[var(--border-color)] flex gap-2">
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={`Message #${activeSpaceId}...`}
					className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
				/>
				<button type="submit" className="bg-[var(--accent)] text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
					Send
				</button>
			</form>
		</div>
	);
}
