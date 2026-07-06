import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useStore, uid } from "@/lib/store";
import usePartySocket from "partysocket/react";
import { Send } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export const Route = createFileRoute("/chat/$userId")({
  component: ChatPage,
});

function ChatPage() {
  const { userId } = Route.useParams();
  const { state, update } = useStore();
  const other = state.users.find((u) => u.id === userId);
  const me = state.currentUserId;
  const messages = state.dms[userId] ?? [];
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  // ⚡ Bolt: Memoize userMap calculation to prevent creating a new object on every render
  const userMap = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);

  const roomName = [me, userId].sort().join("_");

  const socket = usePartySocket({
    host: typeof window !== "undefined" ? window.location.host : undefined,
    party: "chat",
    room: roomName,
    onMessage: (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "add") {
          update((s) => ({
            ...s,
            dms: {
              ...s.dms,
              [userId]: [...(s.dms[userId] ?? []), msg].slice(-100),
            },
          }));
        } else if (msg.type === "all") {
          update((s) => ({
            ...s,
            dms: { ...s.dms, [userId]: msg.messages },
          }));
        }
      } catch (err) {
        console.error("Failed to parse party socket message", err);
      }
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!other) return <div className="p-8">User not found. <Link to="/">Home</Link></div>;

  const send = () => {
    const t = text.trim();
    if (!t) return;
    socket.send(
      JSON.stringify({
        type: "add",
        id: uid(),
        text: t,
        userId: me,
        ts: Date.now(),
      })
    );
    setText("");
  };

  return (
    <>
      <header className="h-14 flex items-center gap-3 px-4 sm:px-6 border-b border-border bg-card/30">
        <SidebarTrigger className="sm:hidden" />
        <div className="size-8 rounded-full bg-muted ring-1 ring-border grid place-items-center text-xs font-medium">{other.initials}</div>
        <div>
          <p className="text-sm font-semibold">{other.name}</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-primary inline-block" /> Online
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground italic py-12">Say hi to {other.name}.</p>
          )}
          {messages.map((m) => {
            const mine = m.userId === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} gap-2`}>
                {!mine && (
                  <div className="size-7 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[10px] flex-shrink-0">
                    {userMap[m.userId]?.initials}
                  </div>
                )}
                <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                  mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"
                }`}>
                  {m.text}
                  <div className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {timeFormatter.format(m.ts)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      <div className="p-4 border-t border-border bg-card/30">
        <div className="max-w-2xl mx-auto flex items-center gap-2 bg-background border border-border rounded-lg px-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={`Message ${other.name}…`}
            aria-label={`Message ${other.name}`}
            className="flex-1 bg-transparent py-3 text-sm outline-none"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={send}
                  disabled={!text.trim()}
                  aria-label="Send message"
                  className="text-primary hover:text-primary/80 p-1 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <Send className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Send message</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
