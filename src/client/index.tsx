import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function App() {
	const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
	const [loginId, setLoginId] = useState("");
	const [loginPassword, setLoginPassword] = useState("");
	const [loginError, setLoginError] = useState("");

	const [messages, setMessages] = useState<ChatMessage[]>([]);
	// Hardcode the room to "general" since there's only one link
	const room = "general";

	const socket = usePartySocket({
		party: "chat",
		room,
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;
			if (message.type === "add") {
				const foundIndex = messages.findIndex((m) => m.id === message.id);
				if (foundIndex === -1) {
					// probably someone else who added a message
					setMessages((messages) => [
						...messages,
						{
							id: message.id,
							content: message.content,
							user: message.user,
							role: message.role,
						},
					]);
				} else {
					// this usually means we ourselves added a message
					// and it was broadcasted back
					// so let's replace the message with the new message
					setMessages((messages) => {
						return messages
							.slice(0, foundIndex)
							.concat({
								id: message.id,
								content: message.content,
								user: message.user,
								role: message.role,
							})
							.concat(messages.slice(foundIndex + 1));
					});
				}
			} else if (message.type === "update") {
				setMessages((messages) =>
					messages.map((m) =>
						m.id === message.id
							? {
									id: message.id,
									content: message.content,
									user: message.user,
									role: message.role,
								}
							: m,
					),
				);
			} else {
				setMessages(message.messages);
			}
		},
	});

	if (!loggedInUser) {
		return (
			<div className="container" style={{ marginTop: "50px", maxWidth: "400px" }}>
				<h2>Login</h2>
				{loginError && <p style={{ color: "red" }}>{loginError}</p>}
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						setLoginError("");
						try {
							const res = await fetch("/api/login", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ id: loginId, password: loginPassword }),
							});
							const data = await res.json();
							if (res.ok && data.success) {
								setLoggedInUser(data.id);
							} else {
								setLoginError(data.error || "Login failed");
							}
						} catch (err) {
							setLoginError("An error occurred during login.");
						}
					}}
				>
					<div style={{ marginBottom: "1rem" }}>
						<label>ID</label>
						<input
							type="text"
							className="u-full-width"
							value={loginId}
							onChange={(e) => setLoginId(e.target.value)}
							required
						/>
					</div>
					<div style={{ marginBottom: "1rem" }}>
						<label>Password</label>
						<input
							type="password"
							className="u-full-width"
							value={loginPassword}
							onChange={(e) => setLoginPassword(e.target.value)}
							required
						/>
					</div>
					<button type="submit" className="button-primary u-full-width">
						Login
					</button>
				</form>
			</div>
		);
	}

	return (
		<div className="chat container">
			<div style={{ marginBottom: "10px", textAlign: "right" }}>
				Logged in as <strong>{loggedInUser}</strong>
				<button
					onClick={() => setLoggedInUser(null)}
					style={{ marginLeft: "10px" }}
				>
					Logout
				</button>
			</div>
			{messages.map((message) => (
				<div key={message.id} className="row message">
					<div className="two columns user">{message.user}</div>
					<div className="ten columns">{message.content}</div>
				</div>
			))}
			<form
				className="row"
				onSubmit={(e) => {
					e.preventDefault();
					const content = e.currentTarget.elements.namedItem(
						"content",
					) as HTMLInputElement;
					const chatMessage: ChatMessage = {
						id: nanoid(8),
						content: content.value,
						user: loggedInUser,
						role: "user",
					};
					setMessages((messages) => [...messages, chatMessage]);
					// we could broadcast the message here

					socket.send(
						JSON.stringify({
							type: "add",
							...chatMessage,
						} satisfies Message),
					);

					content.value = "";
				}}
			>
				<input
					type="text"
					name="content"
					className="ten columns my-input-text"
					placeholder={`Hello ${loggedInUser}! Type a message...`}
					autoComplete="off"
				/>
				<button type="submit" className="send-message two columns">
					Send
				</button>
			</form>
		</div>
	);
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<App />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
