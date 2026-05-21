import { Server, routePartykitRequest } from "partyserver";
import type { Connection } from "partyserver";
import { Message, ChatMessage } from "../shared";
import nodemailer from "nodemailer";

// @ts-ignore
import ssrHandler from "../../dist/server/server.mjs";

// Helper to generate a secure PBKDF2 hash
async function hashPassword(password: string): Promise<string> {
	const saltBuffer = new Uint8Array(16);
	crypto.getRandomValues(saltBuffer);
	const saltHex = Array.from(saltBuffer).map((b) => b.toString(16).padStart(2, '0')).join('');

	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		enc.encode(password),
		{ name: 'PBKDF2' },
		false,
		['deriveBits']
	);

	const hashBuffer = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: enc.encode(saltHex),
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		256
	);

	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${saltHex}$${hashHex}`;
}

// Helper to compare two strings in constant time
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

type VerifyResult = {
	isValid: boolean;
	needsUpgrade: boolean;
};

// Helper to verify a password against a stored hash (legacy or PBKDF2)
async function verifyPassword(password: string, storedHash: string): Promise<VerifyResult> {
	if (!storedHash.includes('$')) {
		// Legacy SHA-256 check
		const msgUint8 = new TextEncoder().encode(password);
		const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
		return { isValid: timingSafeEqual(hashHex, storedHash), needsUpgrade: true };
	}

	const [saltHex, originalHash] = storedHash.split('$');

	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		enc.encode(password),
		{ name: 'PBKDF2' },
		false,
		['deriveBits']
	);

	const hashBuffer = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: enc.encode(saltHex),
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		256
	);

	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return { isValid: timingSafeEqual(hashHex, originalHash), needsUpgrade: false };
}

let dbInitialized = false;

// Simple in-memory rate limiter for unauthenticated endpoints
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 25;

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const windowStart = now - RATE_LIMIT_WINDOW_MS;

	let timestamps = rateLimitMap.get(ip) || [];
	// Filter out timestamps older than the window
	timestamps = timestamps.filter(ts => ts > windowStart);

	if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
		rateLimitMap.set(ip, timestamps);
		return true;
	}

	timestamps.push(now);
	rateLimitMap.set(ip, timestamps);

	// Optional: cleanup old entries periodically to prevent memory leak
	if (Math.random() < 0.05) {
		for (const [key, times] of rateLimitMap.entries()) {
			const validTimes = times.filter(ts => ts > windowStart);
			if (validTimes.length === 0) {
				rateLimitMap.delete(key);
			} else {
				rateLimitMap.set(key, validTimes);
			}
		}
	}

	return false;
}

async function initDb(db: D1Database) {
	if (dbInitialized) return;

	await db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, initials TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER DEFAULT 0, last_seen INTEGER DEFAULT 0)").run();
	await db.prepare("CREATE TABLE IF NOT EXISTS spaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, emoji TEXT, columns TEXT, customFields TEXT, emailReminders INTEGER, emailDigestTime TEXT)").run();
	await db.prepare("CREATE TABLE IF NOT EXISTS space_views (id TEXT NOT NULL, space_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, settings TEXT NOT NULL, PRIMARY KEY (id, space_id))").run();
	await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)").run();
	await db.prepare("CREATE TABLE IF NOT EXISTS api_keys (key TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL)").run();

	// Create tables for automations
	await db.prepare(`CREATE TABLE IF NOT EXISTS automation_rules (id TEXT PRIMARY KEY, target_spaces TEXT NOT NULL, conditions TEXT NOT NULL, action_type TEXT NOT NULL, config TEXT NOT NULL, is_recurring INTEGER DEFAULT 0)`).run();
	await db.prepare(`CREATE TABLE IF NOT EXISTS upcoming_events (id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, task_id TEXT NOT NULL, space_id TEXT NOT NULL, status TEXT NOT NULL, action_type TEXT NOT NULL, config TEXT NOT NULL, scheduled_for INTEGER NOT NULL)`).run();
	await db.prepare(`CREATE TABLE IF NOT EXISTS recurring_events (id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, task_id TEXT NOT NULL, space_id TEXT NOT NULL, status TEXT NOT NULL, action_type TEXT NOT NULL, config TEXT NOT NULL, last_run INTEGER DEFAULT 0, next_run INTEGER NOT NULL)`).run();
	await db.prepare(`CREATE TABLE IF NOT EXISTS executed_events (id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, task_id TEXT NOT NULL, space_id TEXT NOT NULL, status TEXT NOT NULL, action_type TEXT NOT NULL, config TEXT NOT NULL, executed_at INTEGER NOT NULL)`).run();
	await db.prepare(`CREATE TABLE IF NOT EXISTS daily_activity (user_id TEXT NOT NULL, date TEXT NOT NULL, action TEXT NOT NULL, PRIMARY KEY (user_id, date, action))`).run();
	await db.prepare(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, space_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL, assignee TEXT, due_date TEXT, start_date TEXT, priority TEXT, custom TEXT)`).run();

	// Migrate old dynamic tables to unified tasks table
	const { results: tables } = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'tasks_%' AND name != 'tasks_old'").all();
	if (tables && tables.length > 0) {
		const { results: spaces } = await db.prepare("SELECT id FROM spaces").all();
		for (const table of tables) {
			const tableName = table.name as string;
			const safeId = tableName.replace('tasks_', '');

			let originalSpaceId = safeId;
			for (const space of spaces) {
				const sId = space.id as string;
				if (sId.replace(/[^a-zA-Z0-9_]/g, '') === safeId) {
					originalSpaceId = sId;
					break;
				}
			}

			try {
				await db.prepare(`INSERT OR IGNORE INTO tasks (id, space_id, title, description, status, assignee, due_date, start_date, priority, custom) SELECT id, ?, title, description, status, assignee, due_date, start_date, priority, custom FROM ${tableName}`).bind(originalSpaceId).run();
				await db.prepare(`DROP TABLE ${tableName}`).run();
			} catch (err) {
				console.error(`Failed to migrate table ${tableName}`, err);
			}
		}
	}

	dbInitialized = true;
}

export default {
	async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
		await initDb(env.DB);
		const now = new Date();
		const today = now.toISOString().split('T')[0];

		const yesterdayDate = new Date(now);
		yesterdayDate.setDate(yesterdayDate.getDate() - 1);
		const yesterday = yesterdayDate.toISOString().split('T')[0];
		const nowTime = now.getTime();

		// Daily Check Automation - run only around midnight
		const currentHour = now.getHours();
		if (currentHour === 0 && env.SMTP_USER && env.SMTP_PASS) {
			const { results: users } = await env.DB.prepare("SELECT * FROM users LIMIT 2").all();
			for (const user of users) {
				// At midnight, we evaluate the activity of the *previous* day (yesterday)
				const { results: activities } = await env.DB.prepare("SELECT action FROM daily_activity WHERE user_id = ? AND date = ?").bind(user.id, yesterday).all();

				const hasCreated = activities.some((a: any) => a.action === 'created');
				const hasDone = activities.some((a: any) => a.action === 'done');
				const hasSentEmail = activities.some((a: any) => a.action === 'email_sent');

				// Logic: If NOT (created at least one AND moved at least one to Done)
				if ((!hasCreated || !hasDone) && !hasSentEmail) {
					try {
						const transport = nodemailer.createTransport({
							host: env.SMTP_HOST || "smtp.gmail.com",
							port: Number(env.SMTP_PORT) || 465,
							secure: true,
							auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
						});
						await transport.sendMail({
							from: env.SMTP_USER,
							to: user.email as string,
							subject: "SyncDuo Daily Reminder",
							text: "Hello! You haven't created and completed at least one task today. Let's keep the momentum going!"
						});
						// Mark that we sent the email for yesterday so we don't spam
						await env.DB.prepare("INSERT INTO daily_activity (user_id, date, action) VALUES (?, ?, 'email_sent')").bind(user.id, yesterday).run();
					} catch (err) {
						console.error("Daily check email failed", err);
					}
				}
			}
		}

		// 1. Evaluate automations to create events
		const { results: automations } = await env.DB.prepare("SELECT * FROM automation_rules").all();
		const { results: allSpaces } = await env.DB.prepare("SELECT id FROM spaces").all();

		for (const auto of automations) {
			const targetSpaces = JSON.parse(auto.target_spaces as string) as string[];
			const conditions = JSON.parse(auto.conditions as string) as { type: string; config?: any }[];
			const actionType = auto.action_type as string;
			const configStr = auto.config as string;
			const isRecurring = auto.is_recurring === 1;

			// Determine spaces to query
			const spacesToQuery = targetSpaces.length > 0 ? targetSpaces : allSpaces.map(s => s.id as string);

			for (const spaceId of spacesToQuery) {
				try {
					// Separate space-level conditions and task-level conditions
					const spaceConditions = conditions.filter(c => ['no_new_tasks_created', 'no_new_tasks_in_status', 'no_new_tasks_by_user_in_status', 'no_new_tasks_in_priority', 'no_new_tasks_by_user_in_priority', 'space_activity'].includes(c.type));
					const taskConditions = conditions.filter(c => !['no_new_tasks_created', 'no_new_tasks_in_status', 'no_new_tasks_by_user_in_status', 'no_new_tasks_in_priority', 'no_new_tasks_by_user_in_priority', 'space_activity'].includes(c.type));

					let spaceConditionsMet = true;

					if (spaceConditions.length > 0) {
						for (const cond of spaceConditions) {
							if (cond.type === 'no_new_tasks_created') {
								const { results: created } = await env.DB.prepare(`SELECT user_id FROM daily_activity WHERE date = ? AND action = ? LIMIT 1`).bind(today, `space_${spaceId}_created`).all();
								if (created.length > 0) spaceConditionsMet = false;
							} else if (cond.type === 'no_new_tasks_in_status') {
								const { results: statusLogs } = await env.DB.prepare(`SELECT user_id FROM daily_activity WHERE date = ? AND action = ? LIMIT 1`).bind(today, `space_${spaceId}_status_${cond.config?.status}`).all();
								if (statusLogs.length > 0) spaceConditionsMet = false;
							} else if (cond.type === 'no_new_tasks_by_user_in_status') {
								const { results: userStatusLogs } = await env.DB.prepare(`SELECT user_id FROM daily_activity WHERE user_id = ? AND date = ? AND action = ? LIMIT 1`).bind(cond.config?.user_id, today, `space_${spaceId}_status_${cond.config?.status}`).all();
								if (userStatusLogs.length > 0) spaceConditionsMet = false;
							} else if (cond.type === 'no_new_tasks_in_priority') {
								const { results: priorityLogs } = await env.DB.prepare(`SELECT user_id FROM daily_activity WHERE date = ? AND action = ? LIMIT 1`).bind(today, `space_${spaceId}_priority_${cond.config?.priority}`).all();
								if (priorityLogs.length > 0) spaceConditionsMet = false;
							} else if (cond.type === 'no_new_tasks_by_user_in_priority') {
								const { results: userPriorityLogs } = await env.DB.prepare(`SELECT user_id FROM daily_activity WHERE user_id = ? AND date = ? AND action = ? LIMIT 1`).bind(cond.config?.user_id, today, `space_${spaceId}_priority_${cond.config?.priority}`).all();
								if (userPriorityLogs.length > 0) spaceConditionsMet = false;
							} else if (cond.type === 'space_activity') {
								const { event, user, value } = cond.config || {};
								let actionTarget = "";
								if (event === "no_created") actionTarget = `space_${spaceId}_created`;
								else if (event === "no_status") actionTarget = `space_${spaceId}_status_${value}`;
								else if (event === "no_priority") actionTarget = `space_${spaceId}_priority_${value}`;

								let q = "";
								let bindArgs: any[] = [];
								if (user === "any") {
									q = `SELECT user_id FROM daily_activity WHERE date = ? AND action = ? LIMIT 1`;
									bindArgs = [today, actionTarget];
								} else {
									q = `SELECT user_id FROM daily_activity WHERE user_id = ? AND date = ? AND action = ? LIMIT 1`;
									bindArgs = [user, today, actionTarget];
								}
								const { results: activityLogs } = await env.DB.prepare(q).bind(...bindArgs).all();
								if (activityLogs.length > 0) spaceConditionsMet = false;
							}
							if (!spaceConditionsMet) break;
						}
					}

					// If space conditions were defined but failed, skip to next space
					if (spaceConditions.length > 0 && !spaceConditionsMet) continue;

					// If there are space-level conditions and NO task-level conditions, we execute once per space
					if (spaceConditions.length > 0 && taskConditions.length === 0) {
						if (spaceConditionsMet) {
							const taskId = "space-level"; // Generic ID for space-level executions

							if (isRecurring) {
								const { results: existingRec } = await env.DB.prepare(`SELECT id FROM recurring_events WHERE automation_id = ? AND task_id = ? AND space_id = ?`).bind(auto.id, taskId, spaceId).all();
								if (existingRec.length === 0) {
									await env.DB.prepare(`INSERT INTO recurring_events (id, automation_id, task_id, space_id, status, action_type, config, last_run, next_run) VALUES (?, ?, ?, ?, 'pending', ?, ?, 0, ?)`)
										.bind(crypto.randomUUID(), auto.id, taskId, spaceId, actionType, configStr, nowTime).run();
								}
							} else {
								const { results: existingUp } = await env.DB.prepare(`SELECT id FROM upcoming_events WHERE automation_id = ? AND task_id = ? AND space_id = ? AND scheduled_for >= ?`).bind(auto.id, taskId, spaceId, nowTime - 86400000).all(); // Last 24 hours
								const { results: existingExec } = await env.DB.prepare(`SELECT id FROM executed_events WHERE automation_id = ? AND task_id = ? AND space_id = ?`).bind(auto.id, taskId, spaceId).all();

								if (existingUp.length === 0 && existingExec.length === 0) {
									await env.DB.prepare(`INSERT INTO upcoming_events (id, automation_id, task_id, space_id, status, action_type, config, scheduled_for) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`)
										.bind(crypto.randomUUID(), auto.id, taskId, spaceId, actionType, configStr, nowTime).run();
								}
							}
						}
						// Continue to next space since task iteration is not needed
						continue;
					}

					// If there are task-level conditions (whether or not there are space conditions that passed)
					// Query tasks dynamically
				const { results: tasks } = await env.DB.prepare(`SELECT * FROM tasks WHERE space_id = ?`).bind(spaceId).all();

					for (const task of tasks) {
						const taskId = task.id as string;
						let allMatches = true;

						// Check task complex conditions (AND logic)
						for (const cond of taskConditions) {
							if (cond.type === 'due_today') {
								if (task.due_date !== today) allMatches = false;
							} else if (cond.type === 'has_assignee') {
								if (task.assignee === '' || task.assignee === null) allMatches = false;
							} else if (cond.type === 'no_assignee') {
								if (task.assignee !== '' && task.assignee !== null) allMatches = false;
							} else if (cond.type === 'status_equals') {
								if (task.status !== cond.config?.status) allMatches = false;
							} else if (cond.type === 'status_not_equals') {
								if (task.status === cond.config?.status) allMatches = false;
							} else if (cond.type === 'priority_equals') {
								if (task.priority !== cond.config?.priority) allMatches = false;
							} else if (cond.type === 'priority_not_equals') {
								if (task.priority === cond.config?.priority) allMatches = false;
							} else if (cond.type === 'due_date_equals') {
								if (task.due_date !== cond.config?.dueDate) allMatches = false;
							} else if (cond.type === 'assignee_equals') {
								if (task.assignee !== cond.config?.assignee) allMatches = false;
							} else if (cond.type === 'task_field') {
								const { field, operator, value } = cond.config || {};
								let taskVal: any = "";
								if (field === "status") taskVal = task.status;
								else if (field === "priority") taskVal = task.priority;
								else if (field === "assignee") taskVal = task.assignee;
								else if (field === "due_date") taskVal = task.due_date;
								else if (field?.startsWith("custom_")) {
									const customKey = field.replace("custom_", "");
									try {
										const customObj = task.custom ? JSON.parse(task.custom as string) : {};
										taskVal = customObj[customKey] || "";
									} catch {
										taskVal = "";
									}
								}

								if (operator === "equals" && taskVal !== value) allMatches = false;
								else if (operator === "not_equals" && taskVal === value) allMatches = false;
								else if (operator === "is_empty" && (taskVal !== "" && taskVal !== null && taskVal !== undefined)) allMatches = false;
								else if (operator === "not_empty" && (taskVal === "" || taskVal === null || taskVal === undefined)) allMatches = false;
								else if (operator === "is_today" && field === "due_date" && taskVal !== today) allMatches = false;
								else if (operator === "is_overdue" && field === "due_date") {
									if (!taskVal || taskVal >= today) allMatches = false;
								}
							}
							if (!allMatches) break;
						}

						// If no conditions are set, don't trigger on every task by default
						if (conditions.length === 0) allMatches = false;

						if (allMatches) {
							// Queue the event if it hasn't been queued/executed recently
							const table = isRecurring ? 'recurring_events' : 'upcoming_events';

							if (isRecurring) {
								const { results: existingRec } = await env.DB.prepare(`SELECT id FROM recurring_events WHERE automation_id = ? AND task_id = ?`).bind(auto.id, taskId).all();
								if (existingRec.length === 0) {
									await env.DB.prepare(`INSERT INTO recurring_events (id, automation_id, task_id, space_id, status, action_type, config, last_run, next_run) VALUES (?, ?, ?, ?, 'pending', ?, ?, 0, ?)`)
										.bind(crypto.randomUUID(), auto.id, taskId, spaceId, actionType, configStr, nowTime).run();
								}
							} else {
								// For one-time upcoming, ensure it wasn't queued in the last 24h OR ever executed
								const { results: existingUp } = await env.DB.prepare(`SELECT id FROM upcoming_events WHERE automation_id = ? AND task_id = ? AND scheduled_for >= ?`).bind(auto.id, taskId, nowTime - 86400000).all(); // Last 24 hours
								const { results: existingExec } = await env.DB.prepare(`SELECT id FROM executed_events WHERE automation_id = ? AND task_id = ?`).bind(auto.id, taskId).all();

								if (existingUp.length === 0 && existingExec.length === 0) {
									await env.DB.prepare(`INSERT INTO upcoming_events (id, automation_id, task_id, space_id, status, action_type, config, scheduled_for) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`)
										.bind(crypto.randomUUID(), auto.id, taskId, spaceId, actionType, configStr, nowTime).run();
								}
							}
						}
					}
				} catch (e) {
					// Tasks table querying failed
				}
			}
		}

		// 2. Execute pending events (Upcoming and Recurring)
		const { results: pendingUpcoming } = await env.DB.prepare(`SELECT * FROM upcoming_events WHERE status = 'pending' AND scheduled_for <= ?`).bind(nowTime).all();
		const { results: pendingRecurring } = await env.DB.prepare(`SELECT * FROM recurring_events WHERE status = 'pending' AND next_run <= ?`).bind(nowTime).all();

		const allPendingEvents = [
			...pendingUpcoming.map((e: any) => ({ ...e, isRecurring: false })),
			...pendingRecurring.map((e: any) => ({ ...e, isRecurring: true }))
		];

		for (const event of allPendingEvents) {
			const eventId = event.id as string;
			const taskId = event.task_id as string;
			const spaceId = event.space_id as string;
			const actionType = event.action_type as string;
			const config = JSON.parse(event.config as string);
			const automationId = event.automation_id as string;
			const isRecurring = event.isRecurring as boolean;

			try {
				if (actionType === 'send_email' && env.SMTP_USER && env.SMTP_PASS && config.target_user_id) {
					const { results: userRecord } = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(config.target_user_id).all();
					if (userRecord.length > 0 && userRecord[0].email) {
						const email = userRecord[0].email as string;
						const transport = nodemailer.createTransport({
							host: env.SMTP_HOST || "smtp.gmail.com",
							port: Number(env.SMTP_PORT) || 465,
							secure: true,
							auth: {
								user: env.SMTP_USER,
								pass: env.SMTP_PASS
							}
						});
						await transport.sendMail({
							from: env.SMTP_USER,
							to: email,
							subject: `Automation Alert: Task ${taskId}`,
							text: `Automation triggered for task ${taskId} in space ${spaceId}.`,
						});
					}
				} else if (actionType === 'change_status' && config.new_status) {
					if (taskId === "space-level") {
						throw new Error("Cannot change_status on space-level execution");
					}
					await env.DB.prepare(`UPDATE tasks SET status = ? WHERE id = ? AND space_id = ?`).bind(config.new_status, taskId, spaceId).run();
					// Broadcast update
					const { results: taskData } = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ? AND space_id = ?`).bind(taskId, spaceId).all();
					if (taskData.length > 0) {
						const r = taskData[0] as any;
						const updatedTask = { ...r, dueDate: r.due_date, startDate: r.start_date, custom: r.custom ? JSON.parse(r.custom) : {} };
						const idStr = env.Chat.idFromName(spaceId);
						const chatStub = env.Chat.get(idStr);
						await chatStub.fetch(new Request("http://internal/broadcast_task", {
							method: "POST",
							body: JSON.stringify({ type: "task_updated", task: updatedTask })
						}));
					}
				} else if (actionType === 'move_space' && config.new_space_id) {
					if (taskId === "space-level") {
						throw new Error("Cannot move_space on space-level execution");
					}
					// Fetch task
					const { results: taskData } = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ? AND space_id = ?`).bind(taskId, spaceId).all();
					if (taskData.length > 0) {
						const t = taskData[0] as any;
						// Insert into new space
						await env.DB.prepare(`UPDATE tasks SET space_id = ? WHERE id = ? AND space_id = ?`)
							.bind(config.new_space_id, taskId, spaceId).run();

						// Broadcast updates
						const oldStr = env.Chat.idFromName(spaceId);
						const oldStub = env.Chat.get(oldStr);
						await oldStub.fetch(new Request("http://internal/broadcast_task", {
							method: "POST",
							body: JSON.stringify({ type: "task_deleted", id: taskId })
						}));
						const updatedTask = { ...t, dueDate: t.due_date, startDate: t.start_date, custom: t.custom ? JSON.parse(t.custom) : {} };
						const newStr = env.Chat.idFromName(config.new_space_id);
						const newStub = env.Chat.get(newStr);
						await newStub.fetch(new Request("http://internal/broadcast_task", {
							method: "POST",
							body: JSON.stringify({ type: "task_updated", task: updatedTask })
						}));
					}
				} else {
					throw new Error(`Unsupported action_type: ${actionType}`);
				}

				if (isRecurring) {
					// Schedule for next day
					await env.DB.prepare(`UPDATE recurring_events SET last_run = ?, next_run = ? WHERE id = ?`).bind(nowTime, nowTime + 86400000, eventId).run();
				} else {
					// Mark as executed and move to executed_events
					await env.DB.prepare(`INSERT INTO executed_events (id, automation_id, task_id, space_id, status, action_type, config, executed_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`)
						.bind(crypto.randomUUID(), automationId, taskId, spaceId, actionType, event.config as string, nowTime).run();
					await env.DB.prepare(`DELETE FROM upcoming_events WHERE id = ?`).bind(eventId).run();
				}
			} catch (e) {
				console.error(`Error executing event ${eventId}:`, e);
				const table = isRecurring ? 'recurring_events' : 'upcoming_events';
				await env.DB.prepare(`UPDATE ${table} SET status = 'failed' WHERE id = ?`).bind(eventId).run();
			}
		}
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const CORS_HEADERS = {
			"Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		const userMatch = url.pathname.match(/^\/api\/user\/([^/]+)$/);
		if (userMatch && request.method === 'GET') {
			const ip = request.headers.get('cf-connecting-ip') || 'unknown';
			if (isRateLimited(ip)) {
				return new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}
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

			const now = Date.now();
			if (existing.length > 0) {
				await env.DB.prepare("UPDATE users SET hash = ?, active = 1, last_seen = ? WHERE id = ?").bind(hashed, now, id).run();
			} else {
				await env.DB.prepare("INSERT INTO users (id, name, email, initials, hash, active, last_seen) VALUES (?, ?, ?, ?, ?, 1, ?)").bind(id, name || id, email || '', initials || id.substring(0,2).toUpperCase(), hashed, now).run();
			}

			const sessionId = crypto.randomUUID();
			await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(sessionId, id, now, now).run();

			const token = sessionId;
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
				const now = Date.now();
				await env.DB.prepare("INSERT INTO users (id, name, email, initials, hash, active, last_seen) VALUES (?, ?, ?, ?, ?, 1, ?)").bind(id, name, email || '', initials, hashed, now).run();

				const sessionId = crypto.randomUUID();
				await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(sessionId, id, now, now).run();

				const token = sessionId;
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

				await initDb(env.DB);
				const { results } = await env.DB.prepare("SELECT hash FROM users WHERE id = ?").bind(id).all();

				if (results.length > 0) {
					const storedHash = (results[0] as any).hash;
					const verification = await verifyPassword(password, storedHash);

					if (verification.isValid) {
						const now = Date.now();
						if (verification.needsUpgrade) {
							const newHash = await hashPassword(password);
							await env.DB.prepare("UPDATE users SET active = 1, last_seen = ?, hash = ? WHERE id = ?").bind(now, newHash, id).run();
						} else {
							await env.DB.prepare("UPDATE users SET active = 1, last_seen = ? WHERE id = ?").bind(now, id).run();
						}

						const sessionId = crypto.randomUUID();
						await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(sessionId, id, now, now).run();

						const token = sessionId;
						return new Response(JSON.stringify({ token }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}
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
			await initDb(env.DB);

			const authHeader = request.headers.get('Authorization');
			const apiKeyHeader = request.headers.get('x-api-key');

			let token = "";
			if (authHeader && authHeader.startsWith('Bearer ')) {
				token = authHeader.substring(7);
			} else if (apiKeyHeader) {
				token = apiKeyHeader;
			}

			if (!token) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			let currentUserId = "";
			try {
				// First check if it's an API Key
				const { results: apiKeyResults } = await env.DB.prepare("SELECT user_id FROM api_keys WHERE key = ?").bind(token).all();

				if (apiKeyResults && apiKeyResults.length > 0) {
					currentUserId = apiKeyResults[0].user_id as string;
				} else {
					// Fallback to Session check
					const sessionId = token;
					const { results } = await env.DB.prepare("SELECT user_id, updated_at FROM sessions WHERE id = ?").bind(sessionId).all();
					if (results.length === 0) {
						throw new Error("Invalid session or API key");
					}

					const session = results[0] as { user_id: string, updated_at: number };
					const now = Date.now();
					// Expire if older than 1 day (86400000 ms)
					if (now - session.updated_at > 86400000) {
						await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
						throw new Error("Session expired");
					}

					// Session is valid, update updated_at
					await env.DB.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").bind(now, sessionId).run();
					currentUserId = session.user_id;
				}
			} catch (e) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/heartbeat' && request.method === 'POST') {
				await env.DB.prepare("UPDATE users SET active = 1, last_seen = ? WHERE id = ?").bind(Date.now(), currentUserId).run();
				return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/apikeys' && request.method === 'POST') {
				const key = `sk_${crypto.randomUUID().replace(/-/g, '')}`;
				const now = Date.now();
				try {
					await env.DB.prepare("INSERT INTO api_keys (key, user_id, created_at) VALUES (?, ?, ?)")
						.bind(key, currentUserId, now).run();
					return new Response(JSON.stringify({ key, created_at: now }), { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Failed to create API key" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			if (url.pathname === '/api/apikeys' && request.method === 'GET') {
				try {
					const { results } = await env.DB.prepare("SELECT key, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC").bind(currentUserId).all();
					return new Response(JSON.stringify(results), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Failed to fetch API keys" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			const apiKeyDeleteMatch = url.pathname.match(/^\/api\/apikeys\/([^/]+)$/);
			if (apiKeyDeleteMatch && request.method === 'DELETE') {
				const key = apiKeyDeleteMatch[1];
				try {
					await env.DB.prepare("DELETE FROM api_keys WHERE key = ? AND user_id = ?").bind(key, currentUserId).run();
					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Failed to delete API key" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
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
				const { results: spaces } = await env.DB.prepare("SELECT * FROM spaces").all();
				const { results: allViews } = await env.DB.prepare("SELECT * FROM space_views").all();

				const viewsBySpace = allViews.reduce((acc: any, view: any) => {
					if (!acc[view.space_id]) acc[view.space_id] = [];
					let parsedSettings = {};
					try {
						parsedSettings = JSON.parse(view.settings);
					} catch (e) {}
					acc[view.space_id].push({
						id: view.id,
						name: view.name,
						type: view.type,
						settings: parsedSettings
					});
					return acc;
				}, {});

				const parsed = spaces.map((r: any) => {
					let views = viewsBySpace[r.id] || [];
					if (views.length === 0) {
						views = [
							{ id: "list", name: "List", type: "list", settings: {} },
							{ id: "kanban", name: "Kanban", type: "kanban", settings: {} },
							{ id: "calendar", name: "Calendar", type: "calendar", settings: {} },
							{ id: "gantt", name: "Gantt", type: "gantt", settings: {} },
							{ id: "table", name: "Table", type: "table", settings: {} }
						];
					}

					return {
						...r,
						views,
						columns: r.columns ? JSON.parse(r.columns) : [{ id: "todo", name: "To Do" }, { id: "doing", name: "Doing" }, { id: "done", name: "Done" }],
						customFields: r.customFields ? JSON.parse(r.customFields) : [],
						emailReminders: Boolean(r.emailReminders),
						tasks: [], // fetched separately
						channel: [] // fetched separately or handled by party socket
					};
				});
				return new Response(JSON.stringify(parsed), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/spaces' && request.method === 'POST') {
				const body = await request.json() as any;
				const id = body.id || Math.random().toString(36).substring(2, 10);
				const name = body.name || 'New Space';
				const color = body.color || 'brand';
				const emoji = body.emoji || '✨';
				const columns = JSON.stringify(body.columns || [{ id: "todo", name: "To Do" }, { id: "doing", name: "Doing" }, { id: "done", name: "Done" }]);
				const customFields = JSON.stringify(body.customFields || []);
				const emailReminders = body.emailReminders ? 1 : 0;
				const emailDigestTime = body.emailDigestTime || '09:00';
				const views = body.views || [
					{ id: "list", name: "List", type: "list", settings: {} },
					{ id: "kanban", name: "Kanban", type: "kanban", settings: {} },
					{ id: "calendar", name: "Calendar", type: "calendar", settings: {} },
					{ id: "gantt", name: "Gantt", type: "gantt", settings: {} },
					{ id: "table", name: "Table", type: "table", settings: {} }
				];

				await env.DB.prepare("INSERT INTO spaces (id, name, color, emoji, columns, customFields, emailReminders, emailDigestTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
					.bind(id, name, color, emoji, columns, customFields, emailReminders, emailDigestTime).run();

				const viewStatements = views.map((v: any) =>
					env.DB.prepare("INSERT INTO space_views (id, space_id, name, type, settings) VALUES (?, ?, ?, ?, ?)")
						.bind(v.id, id, v.name, v.type, JSON.stringify(v.settings || {}))
				);
				if (viewStatements.length > 0) {
					await env.DB.batch(viewStatements);
				}

				return new Response(JSON.stringify({ id }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
			}

			if (url.pathname === '/api/user/test-email' && request.method === 'POST') {
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
						text: "This is a test reminder email sent from your Sync Duo settings.",
					});

					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e: any) {
					return new Response(JSON.stringify({ error: e.message || "Failed to send email" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			const spacePutMatch = url.pathname.match(/^\/api\/spaces\/([^/]+)$/);
			if (spacePutMatch && request.method === 'DELETE') {
				const id = spacePutMatch[1];
				const safeId = id.replace(/[^a-zA-Z0-9_]/g, '');
				try {
					await env.DB.prepare("DELETE FROM spaces WHERE id = ?").bind(id).run();
					await env.DB.prepare("DELETE FROM space_views WHERE space_id = ?").bind(id).run();
					await env.DB.prepare(`DROP TABLE IF EXISTS tasks_${safeId}`).run();

					const idStr = env.Chat.idFromName(id);
					const chatStub = env.Chat.get(idStr);
					await chatStub.fetch(new Request("http://internal/broadcast_task", {
						method: "POST",
						body: JSON.stringify({ type: "space_deleted", space: { id } })
					}));

					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					console.error("DELETE space error:", e);
					return new Response(JSON.stringify({ error: "Failed to delete space" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			if (spacePutMatch && request.method === 'PUT') {
				const id = spacePutMatch[1];
				try {
					const body = await request.json() as any;
					const name = body.name;
					const color = body.color;
					const emoji = body.emoji;
					const views = body.views || [];
					const columns = JSON.stringify(body.columns);
					const customFields = JSON.stringify(body.customFields);
					const emailReminders = body.emailReminders ? 1 : 0;
					const emailDigestTime = body.emailDigestTime;

					await env.DB.prepare("UPDATE spaces SET name = ?, color = ?, emoji = ?, columns = ?, customFields = ?, emailReminders = ?, emailDigestTime = ? WHERE id = ?")
						.bind(name, color, emoji, columns, customFields, emailReminders, emailDigestTime, id).run();

					if (views.length > 0) {
						// Delete old views for this space
						await env.DB.prepare("DELETE FROM space_views WHERE space_id = ?").bind(id).run();
						// Insert new views
						const viewStatements = views.map((v: any) =>
							env.DB.prepare("INSERT INTO space_views (id, space_id, name, type, settings) VALUES (?, ?, ?, ?, ?)")
								.bind(v.id, id, v.name, v.type, JSON.stringify(v.settings || {}))
						);
						if (viewStatements.length > 0) {
							await env.DB.batch(viewStatements);
						}
					}

					const idStr = env.Chat.idFromName(id);
					const chatStub = env.Chat.get(idStr);
					await chatStub.fetch(new Request("http://internal/broadcast_task", {
						method: "POST",
						body: JSON.stringify({ 
							type: "space_updated", 
							space: { id, name, color, emoji, views: views, columns: body.columns, customFields: body.customFields, emailReminders: body.emailReminders, emailDigestTime }
						})
					}));

					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					console.error("PUT space error:", e);
					return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}


			if (url.pathname === '/api/tasks' && request.method === 'GET') {
				const spaceId = url.searchParams.get('space_id');
				if (!spaceId) {
					return new Response(JSON.stringify([]), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
				try {
				const { results } = await env.DB.prepare(`SELECT * FROM tasks WHERE space_id = ?`).bind(spaceId).all();
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
					const userEmail = body.userEmail;

					if (!space_id) {
						return new Response(JSON.stringify({ error: "space_id is required" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}

				await env.DB.prepare(`INSERT OR REPLACE INTO tasks (id, space_id, title, description, status, assignee, due_date, start_date, priority, custom) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
					.bind(id, space_id, title, description, status, assignee, due_date, start_date, priority, custom)
						.run();

					// Log daily activity for Daily Check automation and space-level automations
					if (assignee) {
						const todayStr = new Date().toISOString().split('T')[0];

						let isNewTask = !body.id;
						let statusChanged = false;
						let priorityChanged = false;

						if (!isNewTask) {
							const { results: existingTasks } = await env.DB.prepare(`SELECT status, priority FROM tasks WHERE id = ?`).bind(id).all();
							if (existingTasks.length > 0) {
								const existing = existingTasks[0] as any;
								if (existing.status !== status) statusChanged = true;
								if (existing.priority !== priority) priorityChanged = true;
							} else {
								isNewTask = true;
							}
						}

						if (isNewTask) {
							// It's a new task
							await env.DB.prepare(`INSERT OR IGNORE INTO daily_activity (user_id, date, action) VALUES (?, ?, ?)`).bind(assignee, todayStr, `space_${space_id}_created`).run();
						}
						if (status && (isNewTask || statusChanged)) {
							// Log specific status updates for automations (including 'done')
							await env.DB.prepare(`INSERT OR IGNORE INTO daily_activity (user_id, date, action) VALUES (?, ?, ?)`).bind(assignee, todayStr, `space_${space_id}_status_${status}`).run();
							if (status === 'done') {
								// Legacy specific done track (kept for compatibility with old automations)
								await env.DB.prepare(`INSERT OR IGNORE INTO daily_activity (user_id, date, action) VALUES (?, ?, 'done')`).bind(assignee, todayStr).run();
							}
						}
						if (priority && (isNewTask || priorityChanged)) {
							// Log priority updates for automations
							await env.DB.prepare(`INSERT OR IGNORE INTO daily_activity (user_id, date, action) VALUES (?, ?, ?)`).bind(assignee, todayStr, `space_${space_id}_priority_${priority}`).run();
						}
					}

					const task = {
						id, title, description, status, assignee, dueDate: due_date, startDate: start_date, priority, custom: JSON.parse(custom), space_id
					};

					// Send email reminder if configured
					if (userEmail && env.SMTP_USER && env.SMTP_PASS) {
						const { results } = await env.DB.prepare("SELECT emailReminders FROM spaces WHERE id = ?").bind(space_id).all();
						if (results.length > 0 && results[0].emailReminders) {
							ctx.waitUntil((async () => {
								try {
									const transport = nodemailer.createTransport({
										host: env.SMTP_HOST || "smtp.gmail.com",
										port: Number(env.SMTP_PORT) || 465,
										secure: true,
										auth: {
											user: env.SMTP_USER,
											pass: env.SMTP_PASS
										}
									});
									await transport.sendMail({
										from: env.SMTP_USER,
										to: userEmail,
										subject: `Task Reminder: ${title}`,
										text: `You have an updated task in space ${space_id}.\n\nTitle: ${title}\nDescription: ${description}\nStatus: ${status}\nPriority: ${priority}\nDue Date: ${due_date || 'None'}\n\nCustom settings:\n${custom}`,
									});
								} catch (emailErr) {
									console.error("Failed to send email", emailErr);
								}
							})());
						}
					}

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

			if (url.pathname === '/api/tasks/bulk' && request.method === 'POST') {
				try {
					const { tasks, space_id } = await request.json() as { tasks: any[], space_id: string };
					if (!space_id || !Array.isArray(tasks)) {
						return new Response(JSON.stringify({ error: "space_id and tasks array required" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
					}

					const statements = tasks.map(t => {
						const custom = JSON.stringify(t.custom || {});
					return env.DB.prepare(`INSERT OR REPLACE INTO tasks (id, space_id, title, description, status, assignee, due_date, start_date, priority, custom) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
						.bind(t.id, space_id, t.title, t.description, t.status, t.assignee, t.dueDate, t.startDate, t.priority, custom);
					});

					if (statements.length > 0) {
						await env.DB.batch(statements);
					}

					// Broadcast update (optional: broadcast a bulk message or just multiple)
					const idStr = env.Chat.idFromName(space_id);
					const chatStub = env.Chat.get(idStr);
					// For simplicity in the client, we might want to tell it to refetch everything
					await chatStub.fetch(new Request("http://internal/broadcast_task", {
						method: "POST",
						body: JSON.stringify({ type: "space_updated", space: { id: space_id } }) // Triggering a refresh
					}));

					return new Response(JSON.stringify({ ok: true, count: tasks.length }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					console.error("Bulk import error:", e);
					return new Response(JSON.stringify({ error: "Bulk import failed" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
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
				await env.DB.prepare(`DELETE FROM tasks WHERE id = ? AND space_id = ?`).bind(id, space_id).run();

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

			// Global Automations endpoints
			if (url.pathname === '/api/automations' && request.method === 'GET') {
				try {
					const { results } = await env.DB.prepare("SELECT * FROM automation_rules").all();
					const automations = results.map((r: any) => ({
						id: r.id,
						targetSpaces: JSON.parse(r.target_spaces),
						conditions: JSON.parse(r.conditions),
						action_type: r.action_type,
						config: JSON.parse(r.config),
						isRecurring: r.is_recurring === 1
					}));
					return new Response(JSON.stringify(automations), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Failed to fetch automations" }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			if (url.pathname === '/api/automations' && request.method === 'POST') {
				try {
					const body = await request.json() as any;
					const id = crypto.randomUUID();
					const targetSpaces = JSON.stringify(body.targetSpaces || []);
					const conditions = JSON.stringify(body.conditions || []);
					const action_type = body.action_type;
					const config = JSON.stringify(body.config || {});
					const isRecurring = body.isRecurring ? 1 : 0;

					await env.DB.prepare("INSERT INTO automation_rules (id, target_spaces, conditions, action_type, config, is_recurring) VALUES (?, ?, ?, ?, ?, ?)")
						.bind(id, targetSpaces, conditions, action_type, config, isRecurring).run();

					return new Response(JSON.stringify({ id, targetSpaces: body.targetSpaces || [], conditions: body.conditions || [], action_type, config: body.config, isRecurring: body.isRecurring }), { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Failed to create automation" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				}
			}

			const automationDeleteMatch = url.pathname.match(/^\/api\/automations\/([^/]+)$/);
			if (automationDeleteMatch && request.method === 'DELETE') {
				const automation_id = automationDeleteMatch[1];
				try {
					await env.DB.prepare("DELETE FROM automation_rules WHERE id = ?").bind(automation_id).run();
					return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
				} catch (e) {
					return new Response(JSON.stringify({ error: "Failed to delete automation" }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
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
