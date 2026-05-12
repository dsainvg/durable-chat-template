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

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		if (url.pathname === '/api/auth/check' && request.method === 'GET') {
			const id = url.searchParams.get('id');
			if (!id) {
				return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
			const { results } = await env.DB.prepare("SELECT * FROM pass WHERE id = ?").bind(id).all();
			const hasPassword = results && results.length > 0;
			return new Response(JSON.stringify({ hasPassword }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
		}

		if (url.pathname === '/api/auth/create' && request.method === 'POST') {
			try {
				const { id, password } = await request.json() as { id?: string, password?: string };
				if (!id || !password) {
					return new Response(JSON.stringify({ error: "Missing id or password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}

				// check if exists
				const { results } = await env.DB.prepare("SELECT * FROM pass WHERE id = ?").bind(id).all();
				if (results && results.length > 0) {
					return new Response(JSON.stringify({ error: "User already has a password" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}

				const hashed = await hashPassword(password);
				await env.DB.prepare("INSERT INTO pass (id, hash) VALUES (?, ?)").bind(id, hashed).run();

				const token = btoa(`${id}:${hashed}`);
				return new Response(JSON.stringify({ token }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
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
				const { results } = await env.DB.prepare("SELECT * FROM pass WHERE id = ?").bind(id).all();

				// fallback to hardcoded USERS if not in DB for compatibility, or just DB
				let validHash = USERS[id as keyof typeof USERS];
				if (results && results.length > 0) {
					validHash = (results[0] as any).hash;
				}

				if (validHash === hashed) {
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

				const { results } = await env.DB.prepare("SELECT * FROM pass WHERE id = ?").bind(id).all();
				let validHash = USERS[id as keyof typeof USERS];
				if (results && results.length > 0) {
					validHash = (results[0] as any).hash;
				}

				if (validHash !== hashed) {
					throw new Error("Invalid token");
				}
			} catch (e) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/tasks' && request.method === 'GET') {
				const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
				return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/tasks' && request.method === 'POST') {
				try {
					const body = await request.json() as any;
					if (!body.title) {
						return new Response(JSON.stringify({ error: "Missing title" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}
					const status = body.status || "To Do";
					const task_type = body.task_type || "Task";

					const { results } = await env.DB.prepare("INSERT INTO tasks (title, status, task_type) VALUES (?, ?, ?) RETURNING *")
						.bind(body.title, status, task_type).all();

					return new Response(JSON.stringify(results[0]), { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
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
