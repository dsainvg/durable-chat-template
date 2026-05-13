import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { state } = useStore();
  const first = state.spaces[0];
  if (!first) return <div className="p-8 text-muted-foreground">No spaces yet.</div>;
  return <Navigate to="/space/$spaceId" params={{ spaceId: first.id }} replace />;
}
