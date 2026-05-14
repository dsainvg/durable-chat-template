export type TaskStatus = 'To Do' | 'In Progress' | 'Done';
export type TaskType = 'Task' | 'Bug' | 'Feature';

export interface Task {
	id: number;
	title: string;
	status: TaskStatus;
	task_type: TaskType;
	custom_task_id?: string | null;
	due_date?: string | null;
	start: number;
	duration: number;
	space_id: number;
}

export type ChatMessage = {
	id: string;
	text: string;
	userId: string;
	ts: number;
};

export type Message =
	| {
			type: "add";
			id: string;
			text: string;
			userId: string;
			ts: number;
	  }
	| {
			type: "update";
			id: string;
			text: string;
			userId: string;
			ts: number;
	  }
	| {
			type: "all";
			messages: ChatMessage[];
	  };

export const names = [
	"Alice",
	"Bob",
	"Charlie",
	"David",
	"Eve",
	"Frank",
	"Grace",
	"Heidi",
	"Ivan",
	"Judy",
	"Kevin",
	"Linda",
	"Mallory",
	"Nancy",
	"Oscar",
	"Peggy",
	"Quentin",
	"Randy",
	"Steve",
	"Trent",
	"Ursula",
	"Victor",
	"Walter",
	"Xavier",
	"Yvonne",
	"Zoe",
];
