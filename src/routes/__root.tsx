import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/AppSidebar";
import { useStore, STORAGE_KEY } from "@/lib/store";
import { applyTheme } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { LoginDialog } from "@/components/LoginDialog";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sync Duo — Two-person Workspace" },
      { name: "description", content: "A focused project workspace built for teams of two." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemedLayout() {
  const { state, update } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => { applyTheme(state.theme); }, [state.theme]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem("syncduo_token");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const verifyTokenAndLoadData = async () => {
      const token = localStorage.getItem("syncduo_token");
      if (!token) {
        localStorage.removeItem(STORAGE_KEY);
        update(s => ({
          ...s,
          currentUserId: "",
          users: [],
          spaces: [],
          dms: {},
        }));
        setIsVerifying(false);
        return;
      }

      try {
        const [heartbeatRes, spacesRes, usersRes] = await Promise.all([
          fetch("/api/heartbeat", { method: "POST", headers: { "Authorization": `Bearer ${token}` } }),
          fetch("/api/spaces", { headers: { "Authorization": `Bearer ${token}` } }),
          fetch("/api/users")
        ]);

        if (heartbeatRes.ok) {
          setIsAuthenticated(true);

          let fetchedSpaces: any[] = [];
          if (spacesRes.ok) fetchedSpaces = await spacesRes.json();

          let fetchedUsers: any[] = [];
          if (usersRes.ok) fetchedUsers = await usersRes.json();

          // Restore session user ID from token
          const decoded = atob(token);
          const [currentUserId] = decoded.split(':');

          update(s => ({ ...s, currentUserId, spaces: fetchedSpaces, users: fetchedUsers }));
        } else {
          localStorage.removeItem("syncduo_token");
        }
      } catch (e) {
        console.error("Failed to verify token or load data", e);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyTokenAndLoadData();
  }, [update]);

  const handleLogin = async (token: string, userId: string) => {
    localStorage.setItem("syncduo_token", token);
    try {
      const spacesRes = await fetch("/api/spaces", { headers: { "Authorization": `Bearer ${token}` } });
      let fetchedSpaces: any[] = [];
      if (spacesRes.ok) {
        fetchedSpaces = await spacesRes.json();
        // Fetch tasks for each space
        fetchedSpaces = await Promise.all(
          fetchedSpaces.map(async (space) => {
            try {
              const tasksRes = await fetch(`/api/tasks?space_id=${space.id}`, { headers: { "Authorization": `Bearer ${token}` } });
              if (tasksRes.ok) {
                const tasks = await tasksRes.json();
                return { ...space, tasks };
              }
            } catch (err) {
              console.error(`Failed to fetch tasks for space ${space.id}`, err);
            }
            return { ...space, tasks: [] };
          })
        );
      }

      update(s => ({ ...s, currentUserId: userId, spaces: fetchedSpaces }));
    } catch(e) {
      update(s => ({ ...s, currentUserId: userId }));
    }
    setIsAuthenticated(true);
  };

  if (isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground text-sm animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground relative">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </div>
      <Toaster />
      <LoginDialog isOpen={!isAuthenticated} onLogin={handleLogin} />
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedLayout />
    </QueryClientProvider>
  );
}
