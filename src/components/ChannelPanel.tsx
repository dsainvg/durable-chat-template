import { useState, useRef, useEffect, useMemo } from "react";
import type { Space } from "@/lib/store";
import { useStore, uid } from "@/lib/store";
import { X, Send } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export function ChannelPanel({ space, onClose, onSend }: { space: Space; onClose: () => void; onSend?: (t: string) => void }) {
  const { state, update } = useStore();
  const [text, setText] = useState("");
  // ⚡ Bolt: Memoize userMap calculation to prevent creating a new object on every render
  const userMap = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const me = state.currentUserId;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [space.channel.length]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    if (onSend) {
      onSend(t);
    } else {
      update((s) => ({
        ...s,
        spaces: s.spaces.map((sp) =>
          sp.id === space.id
            ? { ...sp, channel: [...sp.channel, { id: uid(), userId: me, text: t, ts: Date.now() }] }
            : sp
        ),
      }));
    }
    setText("");
  };

  return (
    <aside className="w-full sm:w-80 border-t sm:border-t-0 sm:border-l border-border bg-card flex flex-col flex-shrink-0 h-[50vh] sm:h-auto">
      <div className="h-12 px-4 flex items-center justify-between border-b border-border">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Channel</p>
          <p className="text-xs font-medium">#{space.name.toLowerCase().replace(/\s+/g, "-")}</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onClose} aria-label="Close channel" className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <X className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Close channel</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {space.channel.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No messages yet.</p>
        )}
        {space.channel.map((m) => {
          const u = userMap[m.userId];
          const mine = m.userId === me;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[10px] font-semibold">{u?.name ?? "Unknown"}</span>
                <span className="text-[9px] text-muted-foreground">
                  {timeFormatter.format(m.ts)}
                </span>
              </div>
              <div className={`text-xs px-3 py-2 rounded-lg max-w-[85%] ${
                mine ? "bg-primary/15 text-foreground" : "bg-muted"
              }`}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Message channel…"
            className="flex-1 bg-transparent py-2 text-xs outline-none"
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
    </aside>
  );
}
