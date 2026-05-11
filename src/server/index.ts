// Helper to generate a SHA-256 hash
async function hashPassword(password: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

// password -> 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
const USERS = {
	'sai': '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
	'rups': '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'
};

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function initDb(db: D1Database) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			status TEXT DEFAULT 'To Do',
			task_type TEXT DEFAULT 'Task',
			custom_task_id TEXT,
			due_date TEXT,
			start INTEGER,
			duration INTEGER
		);
	`);

	const { results } = await db.prepare("SELECT count(*) as count FROM tasks").all();
	if (results && results[0] && (results[0] as any).count === 0) {
		await db.exec(`
			INSERT INTO tasks (id, title, status, task_type, custom_task_id, due_date, start, duration) VALUES
			(1, 'Setup Postgres Schema', 'Done', 'Task', 'ENG-1', '2026-05-15', 2, 4),
			(2, 'Implement Next.js Views', 'In Progress', 'Task', 'ENG-2', '2026-05-18', 6, 5),
			(3, 'Configure MCP Server', 'To Do', 'Task', 'ENG-3', '2026-05-20', 10, 3),
			(4, 'Write E2E Tests', 'To Do', 'Bug', 'ENG-4', null, 12, 4)
		`);
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		if (url.pathname === '/api/login' && request.method === 'POST') {
			try {
				const { id, password } = await request.json() as { id?: string, password?: string };
				if (!id || !password) {
					return new Response(JSON.stringify({ error: "Missing id or password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}

				const hashed = await hashPassword(password);
				if (USERS[id as keyof typeof USERS] === hashed) {
					const token = btoa(`${id}:${hashed}`);
					return new Response(JSON.stringify({ token }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}

				return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			} catch (e) {
				return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
		}

		if (url.pathname.startsWith('/api/')) {
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			const token = authHeader.substring(7);
			try {
				const decoded = atob(token);
				const [id, hashed] = decoded.split(':');
				if (USERS[id as keyof typeof USERS] !== hashed) {
					throw new Error("Invalid token");
				}
			} catch (e) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			await initDb(env.DB);

			if (url.pathname === '/api/tasks' && request.method === 'GET') {
				const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
				return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
			if (taskMatch && request.method === 'PUT') {
				const id = parseInt(taskMatch[1]);
				try {
					const body = await request.json() as any;
					const updates = [];
					const values = [];
					let index = 1;

					if (body.status !== undefined) {
						updates.push(`status = ?${index++}`);
						values.push(body.status);
					}
					if (body.due_date !== undefined) {
						updates.push(`due_date = ?${index++}`);
						values.push(body.due_date);
					}

					if (updates.length > 0) {
						values.push(id);
						await env.DB.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?${index}`).bind(...values).run();

						const { results } = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?1").bind(id).all();
						return new Response(JSON.stringify(results[0]), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					} else {
						return new Response(JSON.stringify({ error: "No valid fields to update" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}
				} catch (e) {
					return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			return new Response("Not Implemented", { status: 501, headers: CORS_HEADERS });
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;

// Dummy Chat class to satisfy Durable Object binding that we cannot migrate away from at this time
export class Chat {
	constructor(state: any, env: Env) {}
	async fetch(request: Request) {
		return new Response("Not implemented", { status: 501 });
	}
}
