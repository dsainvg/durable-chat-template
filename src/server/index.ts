import { Server, routePartykitRequest } from "partyserver";
import type { Connection } from "partyserver";
import { Message, ChatMessage } from "../shared";
import nodemailer from "nodemailer";

// @ts-ignore
import ssrHandler from "../../dist/server/server.mjs";

// Helper to generate a SHA-256 hash
async function hashPassword(password: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}


const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

let dbInitialized = false;

async function initDb(db: D1Database) {
	if (dbInitialized) return;

	await db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, initials TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER DEFAULT 0, last_seen INTEGER DEFAULT 0)").run();
	await db.prepare("CREATE TABLE IF NOT EXISTS spaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, emoji TEXT, enabledViews TEXT, columns TEXT, customFields TEXT, emailReminders INTEGER, emailDigestTime TEXT, settings TEXT)").run();

	dbInitialized = true;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		const userMatch = url.pathname.match(/^\/api\/user\/([^/]+)$/);
		if (userMatch && request.method === 'GET') {
			await initDb(env.DB);
			const id = userMatch[1];
			const { results } = await env.DB.prepare("SELECT hash FROM users WHERE id = ?").bind(id).all();
			return new Response(JSON.stringify({ exists: results.length > 0 }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
		}

		const userPassMatch = url.pathname.match(/^\/api\/user\/([^/]+)\/password$/);
		if (userPassMatch && request.method === 'POST') {
			await initDb(env.DB);
			const id = userPassMatch[1];

			const { results: existing } = await env.DB.prepare("SELECT hash FROM users WHERE id = ?").bind(id).all();
			if (existing.length > 0 && existing[0].hash) {
				return new Response(JSON.stringify({ error: "User already has a password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			const { password, name, email, initials } = await request.json() as any;
			if (!password) {
				return new Response(JSON.stringify({ error: "Missing password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
			const hashed = await hashPassword(password);

			if (existing.length > 0) {
				await env.DB.prepare("UPDATE users SET hash = ?, active = 1, last_seen = ? WHERE id = ?").bind(hashed, Date.now(), id).run();
			} else {
				await env.DB.prepare("INSERT INTO users (id, name, email, initials, hash, active, last_seen) VALUES (?, ?, ?, ?, ?, 1, ?)").bind(id, name || id, email || '', initials || id.substring(0,2).toUpperCase(), hashed, Date.now()).run();
			}

			const token = btoa(`${id}:${hashed}`);
			return new Response(JSON.stringify({ token }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
		}


		if (url.pathname === '/api/users' && request.method === 'POST') {
			try {
				const { name, email, password } = await request.json() as any;
				if (!name || !password) {
					return new Response(JSON.stringify({ error: "Missing name or password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
				const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
				const initials = name.substring(0, 2).toUpperCase();
				const hashed = await hashPassword(password);
				await initDb(env.DB);
				await env.DB.prepare("INSERT INTO users (id, name, email, initials, hash, active, last_seen) VALUES (?, ?, ?, ?, ?, 1, ?)").bind(id, name, email || '', initials, hashed, Date.now()).run();
				const token = btoa(`${id}:${hashed}`);
				return new Response(JSON.stringify({ id, token, name, email, initials }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			} catch (e) {
				return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
		}

		if (url.pathname === '/api/login' && request.method === 'POST') {
			try {
				const { id, password } = await request.json() as { id?: string, password?: string };
				if (!id || !password) {
					return new Response(JSON.stringify({ error: "Missing id or password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}

				const hashed = await hashPassword(password);
				await initDb(env.DB);
				const { results } = await env.DB.prepare("SELECT hash FROM users WHERE id = ?").bind(id).all();
				if (results.length > 0 && (results[0] as any).hash === hashed) {
					await env.DB.prepare("UPDATE users SET active = 1, last_seen = ? WHERE id = ?").bind(Date.now(), id).run();
					const token = btoa(`${id}:${hashed}`);
					return new Response(JSON.stringify({ token }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}

				return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			} catch (e) {
				return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
		}

		if (url.pathname.startsWith('/parties/')) {
			return routePartykitRequest(request, env as any) as unknown as Response;
		}

		if (url.pathname.startsWith('/api/')) {
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			const token = authHeader.substring(7);
			let currentUserId = "";
			try {
				const decoded = atob(token);
				const [id, hashed] = decoded.split(':');
				currentUserId = id;
				await initDb(env.DB);
				const { results } = await env.DB.prepare("SELECT hash FROM users WHERE id = ?").bind(id).all();
				if (results.length === 0 || (results[0] as any).hash !== hashed) {
					throw new Error("Invalid token");
				}
			} catch (e) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			await initDb(env.DB);

			if (url.pathname === '/api/heartbeat' && request.method === 'POST') {
				await env.DB.prepare("UPDATE users SET active = 1, last_seen = ? WHERE id = ?").bind(Date.now(), currentUserId).run();
				return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			const userPutMatch = url.pathname.match(/^\/api\/user\/([^/]+)$/);
			if (userPutMatch && request.method === 'PUT') {
				const id = userPutMatch[1];
				// Only allow users to update their own profile
				if (currentUserId !== id) {
					return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
				try {
					const body = await request.json() as any;
					const name = body.name || '';
					const email = body.email || '';
					const initials = body.initials || '';

					await env.DB.prepare("UPDATE users SET name = ?, email = ?, initials = ? WHERE id = ?").bind(name, email, initials, id).run();
					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			if (url.pathname === '/api/users' && request.method === 'GET') {
				const { results } = await env.DB.prepare("SELECT id, name, email, initials, active, last_seen FROM users").all();
				return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/users/status' && request.method === 'GET') {
				const cutoff = Date.now() - 30000; // 30 seconds
				// Update active status for users who haven't sent a heartbeat in 30s
				await env.DB.prepare("UPDATE users SET active = 0 WHERE last_seen < ? AND active = 1").bind(cutoff).run();
				const { results } = await env.DB.prepare("SELECT id, active, last_seen FROM users WHERE id != ?").bind(currentUserId).all();
				return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/spaces' && request.method === 'GET') {
				const { results } = await env.DB.prepare("SELECT * FROM spaces").all();
				const parsed = results.map((r: any) => ({
					...r,
					enabledViews: r.enabledViews ? JSON.parse(r.enabledViews) : { list: true, kanban: true, calendar: true, gantt: true },
					columns: r.columns ? JSON.parse(r.columns) : [{ id: "todo", name: "To Do" }, { id: "doing", name: "Doing" }, { id: "done", name: "Done" }],
					customFields: r.customFields ? JSON.parse(r.customFields) : [],
					emailReminders: Boolean(r.emailReminders),
					settings: r.settings || "{}",
					tasks: [], // fetched separately
					channel: [] // fetched separately or handled by party socket
				}));
				return new Response(JSON.stringify(parsed), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
			if (url.pathname === '/api/spaces' && request.method === 'POST') {
				const body = await request.json() as any;
				const id = body.id || Math.random().toString(36).substring(2, 10);
				const name = body.name || 'New Space';
				const color = body.color || 'brand';
				const emoji = body.emoji || '✨';
				const enabledViews = JSON.stringify(body.enabledViews || { list: true, kanban: true, calendar: true, gantt: true });
				const columns = JSON.stringify(body.columns || [{ id: "todo", name: "To Do" }, { id: "doing", name: "Doing" }, { id: "done", name: "Done" }]);
				const customFields = JSON.stringify(body.customFields || []);
				const emailReminders = body.emailReminders ? 1 : 0;
				const emailDigestTime = body.emailDigestTime || '09:00';
				const settings = body.settings || '{}';

				await env.DB.prepare("INSERT INTO spaces (id, name, color, emoji, enabledViews, columns, customFields, emailReminders, emailDigestTime, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
					.bind(id, name, color, emoji, enabledViews, columns, customFields, emailReminders, emailDigestTime, settings).run();

				const safeId = id.replace(/[^a-zA-Z0-9_]/g, '');
				await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tasks_${safeId} (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL, assignee TEXT, due_date TEXT, start_date TEXT, priority TEXT, custom TEXT)`).run();

				return new Response(JSON.stringify({ id }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			const testEmailMatch = url.pathname.match(/^\/api\/spaces\/([^/]+)\/test-email$/);
			if (testEmailMatch && request.method === 'POST') {
				try {
					const body = await request.json() as any;
					const email = body.email;
					if (!email) {
						return new Response(JSON.stringify({ error: "Missing email address" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}

					if (!env.SMTP_USER || !env.SMTP_PASS) {
						return new Response(JSON.stringify({ error: "SMTP credentials not configured in environment" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}

					const transporter = nodemailer.createTransport({
						host: env.SMTP_HOST || "smtp.gmail.com",
						port: parseInt(env.SMTP_PORT || "465", 10),
						secure: true,
						auth: {
							user: env.SMTP_USER,
							pass: env.SMTP_PASS,
						},
					});

					await transporter.sendMail({
						from: env.SMTP_USER,
						to: email,
						subject: "Test Reminder from Sync Duo",
						text: "This is a test reminder email sent from your Sync Duo space settings.",
					});

					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e: any) {
					return new Response(JSON.stringify({ error: e.message || "Failed to send email" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			const spacePutMatch = url.pathname.match(/^\/api\/spaces\/([^/]+)$/);
			if (spacePutMatch && request.method === 'PUT') {
				const id = spacePutMatch[1];
				try {
					const body = await request.json() as any;
					const name = body.name;
					const color = body.color;
					const emoji = body.emoji;
					const enabledViews = JSON.stringify(body.enabledViews);
					const columns = JSON.stringify(body.columns);
					const customFields = JSON.stringify(body.customFields);
					const emailReminders = body.emailReminders ? 1 : 0;
					const emailDigestTime = body.emailDigestTime;
					const settings = body.settings || '{}';

					await env.DB.prepare("UPDATE spaces SET name = ?, color = ?, emoji = ?, enabledViews = ?, columns = ?, customFields = ?, emailReminders = ?, emailDigestTime = ?, settings = ? WHERE id = ?")
						.bind(name, color, emoji, enabledViews, columns, customFields, emailReminders, emailDigestTime, settings, id).run();

					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}


			if (url.pathname === '/api/tasks' && request.method === 'GET') {
				const spaceId = url.searchParams.get('space_id');
				if (!spaceId) {
					return new Response(JSON.stringify([]), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
				const safeId = spaceId.replace(/[^a-zA-Z0-9_]/g, '');
				try {
					const { results } = await env.DB.prepare(`SELECT * FROM tasks_${safeId}`).all();
					const parsedResults = results.map((r: any) => ({
						...r,
						dueDate: r.due_date,
						startDate: r.start_date,
						custom: r.custom ? JSON.parse(r.custom) : {}
					}));
					return new Response(JSON.stringify(parsedResults), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					// Table might not exist yet
					return new Response(JSON.stringify([]), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			if (url.pathname === '/api/tasks' && request.method === 'POST') {
				try {
					const body = await request.json() as any;
					const id = body.id || Math.random().toString(36).substring(2, 10);
					const title = body.title || 'New Task';
					const description = body.description || '';
					const status = body.status || 'todo';
					const assignee = body.assignee || '';
					const due_date = body.dueDate || null;
					const start_date = body.startDate || null;
					const priority = body.priority || 'medium';
					const custom = JSON.stringify(body.custom || {});
					const space_id = body.space_id;

					if (!space_id) {
						return new Response(JSON.stringify({ error: "space_id is required" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}

					const safeId = space_id.replace(/[^a-zA-Z0-9_]/g, '');

					await env.DB.prepare(`INSERT OR REPLACE INTO tasks_${safeId} (id, title, description, status, assignee, due_date, start_date, priority, custom) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
						.bind(id, title, description, status, assignee, due_date, start_date, priority, custom)
						.run();

					const task = {
						id, title, description, status, assignee, dueDate: due_date, startDate: start_date, priority, custom: JSON.parse(custom), space_id
					};

					// Broadcast update to the space's Chat Durable Object to notify clients
					const idStr = env.Chat.idFromName(space_id);
					const chatStub = env.Chat.get(idStr);
					await chatStub.fetch(new Request("http://internal/broadcast_task", {
						method: "POST",
						body: JSON.stringify({ type: "task_updated", task })
					}));

					return new Response(JSON.stringify(task), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
			if (taskMatch && request.method === 'DELETE') {
				const id = taskMatch[1];
				try {
					const urlParams = new URLSearchParams(url.search);
					const space_id = urlParams.get('space_id');
					if (!space_id) {
						return new Response(JSON.stringify({ error: "space_id required" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}
					const safeId = space_id.replace(/[^a-zA-Z0-9_]/g, '');
					await env.DB.prepare(`DELETE FROM tasks_${safeId} WHERE id = ?`).bind(id).run();

					// Broadcast delete
					const idStr = env.Chat.idFromName(space_id);
					const chatStub = env.Chat.get(idStr);
					await chatStub.fetch(new Request("http://internal/broadcast_task", {
						method: "POST",
						body: JSON.stringify({ type: "task_deleted", id })
					}));

					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			return new Response("Not Implemented", { status: 501, headers: CORS_HEADERS });
		}

		// Fallback to ASSETS (for static files like /assets/... inside dist/client)
		// If it's not an asset, pass to TanStack Start SSR
		let assetResponse;
		if (env.ASSETS) {
			assetResponse = await env.ASSETS.fetch(request);
		}
		if (assetResponse && assetResponse.status < 400) {
			return assetResponse;
		}

		return ssrHandler.fetch(request, env, {});
	},
} satisfies ExportedHandler<Env>;

// Realtime Chat & Task Updates using PartyServer
export class Chat extends Server<Env> {
	messages: ChatMessage[] = [];

	async onStart() {
		// Load existing messages from Durable Object storage
		const stored = await this.ctx.storage.get<ChatMessage[]>("messages");
		if (stored) {
			this.messages = stored;
		}
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/broadcast_task" && request.method === "POST") {
			const body = await request.json() as any;
			// Broadcast task updates to all connected clients in this space
			this.broadcast(JSON.stringify(body));
			return new Response("OK", { status: 200 });
		}
		// otherwise, handle as websocket or normal fetch
		return super.fetch(request);
	}

	onConnect(conn: Connection, ctx: any) {
		// Send existing chat messages to the new connection
		conn.send(JSON.stringify({ type: "all", messages: this.messages }));
	}

	async onMessage(conn: Connection, message: string | ArrayBuffer) {
		const data = JSON.parse(message as string) as Message;
		if (data.type === "add") {
			const newMsg: ChatMessage = {
				id: data.id,
				text: data.text,
				userId: data.userId,
				ts: data.ts,
			};
			this.messages.push(newMsg);
			if (this.messages.length > 100) this.messages.shift(); // Keep last 100

			await this.ctx.storage.put("messages", this.messages);
			this.broadcast(JSON.stringify(data));
		}
	}
}
