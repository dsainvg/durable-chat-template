import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

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

  if (!first) return <div className="p-8 text-muted-foreground">No spaces yet.</div>;
  return null;
}
