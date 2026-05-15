import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { state } = useStore();
  const navigate = useNavigate();
  const first = state.spaces[0];

  useEffect(() => {
    if (first) {
      navigate({ to: "/space/$spaceId", params: { spaceId: first.id }, replace: true });
    }
  }, [first, navigate]);

  if (!first) return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-4 border-b border-border bg-card/30 sm:hidden">
        <SidebarTrigger />
      </header>
      <div className="p-8 text-muted-foreground">No spaces yet.</div>
    </div>
  );
  return null;
}
