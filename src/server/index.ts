// Helper to generate a SHA-256 hash
async function hashPassword(password: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

// password -> 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function initDb(db: D1Database) {
	await db.prepare("CREATE TABLE IF NOT EXISTS pass (id TEXT PRIMARY KEY, hash TEXT NOT NULL)").run();

	// Create spaces table
	await db.prepare("CREATE TABLE IF NOT EXISTS spaces (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)").run();

	// Create templates table
	await db.prepare("CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, default_status TEXT, default_type TEXT, duration INTEGER)").run();

	// Create tasks table with space_id
	await db.prepare("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, status TEXT DEFAULT 'To Do', task_type TEXT DEFAULT 'Task', custom_task_id TEXT, due_date TEXT, start INTEGER, duration INTEGER, space_id INTEGER)").run();

	// Add space_id to existing tasks if needed (sqlite doesn't fail if column exists using catch)
	try {
		await db.prepare("ALTER TABLE tasks ADD COLUMN space_id INTEGER DEFAULT 1").run();
	} catch(e) {}

	const { results: spaces } = await db.prepare("SELECT count(*) as count FROM spaces").all();
	if (spaces && spaces[0] && (spaces[0] as any).count === 0) {
		await db.prepare("INSERT INTO spaces (name) VALUES ('General Development'), ('Design'), ('Marketing')").run();
	}

	const { results: templates } = await db.prepare("SELECT count(*) as count FROM templates").all();
	if (templates && templates[0] && (templates[0] as any).count === 0) {
		await db.prepare("INSERT INTO templates (name, default_status, default_type, duration) VALUES ('Standard Bug', 'To Do', 'Bug', 2), ('Quick Feature', 'To Do', 'Feature', 5)").run();
	}

	const { results } = await db.prepare("SELECT count(*) as count FROM tasks").all();
	if (results && results[0] && (results[0] as any).count === 0) {
		await db.prepare("INSERT INTO tasks (id, title, status, task_type, custom_task_id, due_date, start, duration, space_id) VALUES (1, 'Setup Postgres Schema', 'Done', 'Task', 'ENG-1', '2026-05-15', 2, 4, 1), (2, 'Implement Next.js Views', 'In Progress', 'Task', 'ENG-2', '2026-05-18', 6, 5, 1), (3, 'Configure MCP Server', 'To Do', 'Task', 'ENG-3', '2026-05-20', 10, 3, 1), (4, 'Write E2E Tests', 'To Do', 'Bug', 'ENG-4', null, 12, 4, 1)").run();
	}
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
			const { results } = await env.DB.prepare("SELECT hash FROM pass WHERE id = ?").bind(id).all();
			return new Response(JSON.stringify({ exists: results.length > 0 }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
		}

		const userPassMatch = url.pathname.match(/^\/api\/user\/([^/]+)\/password$/);
		if (userPassMatch && request.method === 'POST') {
			await initDb(env.DB);
			const id = userPassMatch[1];

			const { results: existing } = await env.DB.prepare("SELECT hash FROM pass WHERE id = ?").bind(id).all();
			if (existing.length > 0) {
				return new Response(JSON.stringify({ error: "User already has a password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			const { password } = await request.json() as any;
			if (!password) {
				return new Response(JSON.stringify({ error: "Missing password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
			const hashed = await hashPassword(password);
			await env.DB.prepare("INSERT INTO pass (id, hash) VALUES (?, ?)").bind(id, hashed).run();
			const token = btoa(`${id}:${hashed}`);
			return new Response(JSON.stringify({ token }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
		}


		if (url.pathname === '/api/login' && request.method === 'POST') {
			try {
				const { id, password } = await request.json() as { id?: string, password?: string };
				if (!id || !password) {
					return new Response(JSON.stringify({ error: "Missing id or password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}

				const hashed = await hashPassword(password);
				await initDb(env.DB);
				const { results } = await env.DB.prepare("SELECT hash FROM pass WHERE id = ?").bind(id).all();
				if (results.length > 0 && (results[0] as any).hash === hashed) {
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
				await initDb(env.DB);
				const { results } = await env.DB.prepare("SELECT hash FROM pass WHERE id = ?").bind(id).all();
				if (results.length === 0 || (results[0] as any).hash !== hashed) {
					throw new Error("Invalid token");
				}
			} catch (e) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			await initDb(env.DB);


			if (url.pathname === '/api/spaces' && request.method === 'GET') {
				const { results } = await env.DB.prepare("SELECT * FROM spaces").all();
				return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
			if (url.pathname === '/api/spaces' && request.method === 'POST') {
				const body = await request.json() as any;
				const { meta } = await env.DB.prepare("INSERT INTO spaces (name) VALUES (?)").bind(body.name).run();
				return new Response(JSON.stringify({ id: meta.last_row_id }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/templates' && request.method === 'GET') {
				const { results } = await env.DB.prepare("SELECT * FROM templates").all();
				return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
			if (url.pathname === '/api/templates' && request.method === 'POST') {
				const body = await request.json() as any;
				const { meta } = await env.DB.prepare("INSERT INTO templates (name, default_status, default_type, duration) VALUES (?1, ?2, ?3, ?4)")
					.bind(body.name, body.default_status || 'To Do', body.default_type || 'Task', body.duration || 1)
					.run();
				return new Response(JSON.stringify({ id: meta.last_row_id }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/tasks' && request.method === 'GET') {
				const spaceId = url.searchParams.get('space_id');
				let results;
				if (spaceId) {
					results = (await env.DB.prepare("SELECT * FROM tasks WHERE space_id = ?").bind(parseInt(spaceId)).all()).results;
				} else {
					results = (await env.DB.prepare("SELECT * FROM tasks").all()).results;
				}
				return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/tasks' && request.method === 'POST') {
				try {
					const body = await request.json() as any;
					const title = body.title || 'New Task';
					const status = body.status || 'To Do';
					const task_type = body.task_type || 'Task';
					const custom_task_id = body.custom_task_id || `ENG-${Math.floor(Math.random() * 1000)}`;
					const due_date = body.due_date || null;
					const start = body.start || 1;
					const duration = body.duration || 1;
					const space_id = body.space_id || 1;

					const { meta } = await env.DB.prepare("INSERT INTO tasks (title, status, task_type, custom_task_id, due_date, start, duration, space_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
						.bind(title, status, task_type, custom_task_id, due_date, start, duration, space_id)
						.run();

					return new Response(JSON.stringify({ id: meta.last_row_id }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
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
					if (body.title !== undefined) {
						updates.push(`title = ?${index++}`);
						values.push(body.title);
					}
					if (body.task_type !== undefined) {
						updates.push(`task_type = ?${index++}`);
						values.push(body.task_type);
					}
					if (body.custom_task_id !== undefined) {
						updates.push(`custom_task_id = ?${index++}`);
						values.push(body.custom_task_id);
					}
					if (body.start !== undefined) {
						updates.push(`start = ?${index++}`);
						values.push(body.start);
					}
					if (body.duration !== undefined) {
						updates.push(`duration = ?${index++}`);
						values.push(body.duration);
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
