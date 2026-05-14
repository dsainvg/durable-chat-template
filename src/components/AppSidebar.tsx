import { Link, useRouterState } from "@tanstack/react-router";
import { Settings, Plus, MessageSquare, Hash } from "lucide-react";
import { useStore, uid } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state, update } = useStore();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const me = state.users.find((u) => u.id === state.currentUserId)!;
  const others = state.users.filter((u) => u.id !== me.id);

  const addSpace = () => {
    const name = prompt("Space name?");
    if (!name) return;
    update((s) => ({
      ...s,
      spaces: [
        ...s.spaces,
        {
          id: uid(),
          name,
          color: "brand",
          emoji: "✨",
          enabledViews: { list: true, kanban: true, calendar: true, gantt: true },
          columns: [
            { id: "todo", name: "To Do" },
            { id: "doing", name: "Doing" },
            { id: "done", name: "Done" },
          ],
          customFields: [],
          emailReminders: false,
          emailDigestTime: "09:00",
          tasks: [],
          channel: [],
        },
      ],
    }));
  };

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-sidebar">
      <div className="p-4 flex items-center gap-2">
        <div className="size-7 rounded bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center">
          <div className="size-2.5 rounded-full bg-primary" />
        </div>
        <span className="font-semibold tracking-tight">Sync Duo</span>
      </div>

      <nav className="flex-1 px-3 space-y-6 overflow-y-auto pt-2">
        <div>
          <div className="px-2 mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spaces</p>
            <button onClick={addSpace} aria-label="Add space" className="text-muted-foreground hover:text-foreground">
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {state.spaces.map((sp) => {
              const active = path.startsWith(`/space/${sp.id}`);
              return (
                <Link
                  key={sp.id}
                  to="/space/$spaceId"
                  params={{ spaceId: sp.id }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                    active ? "bg-accent text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <span className="text-xs">{sp.emoji}</span>
                  <span className="truncate">{sp.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Direct Messages</p>
          <div className="space-y-0.5">
            {others.map((u) => {
              const active = path === `/chat/${u.id}`;
              return (
                <Link
                  key={u.id}
                  to="/chat/$userId"
                  params={{ userId: u.id }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                    active ? "bg-accent text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <div className="size-5 rounded bg-muted ring-1 ring-border grid place-items-center text-[10px]">{u.initials}</div>
                  <span className="truncate">{u.name}</span>
                  <div className="ml-auto size-1.5 rounded-full bg-primary" />
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          to="/settings"
          className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors ${
            path === "/settings" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Settings className="size-4" />
          <span>Settings</span>
        </Link>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="size-7 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[11px] font-medium">{me.initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{me.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{me.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
