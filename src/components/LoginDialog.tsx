import { useState, useEffect } from "react";
import { useStore, type User } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const API_URL = "";

export function LoginDialog({
  isOpen,
  onLogin,
}: {
  isOpen: boolean;
  onLogin: (token: string, userId: string) => void;
}) {
  const { update } = useStore();
  const [users, setUsers] = useState<User[]>([]);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [step, setStep] = useState<"select" | "password" | "create" | "new_user">("select");
  const [password, setPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch users when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedUser(null);
      setStep("select");
      setPassword("");
      setNewUserName("");
      setError("");

      const fetchUsers = async () => {
        setIsLoading(true);
        try {
          const res = await fetch(`${API_URL}/api/users`);
          if (res.ok) {
            const data = await res.json() as User[];
            setUsers(data);
            update(s => ({ ...s, users: data }));
          }
        } catch (e) {
          console.error("Failed to fetch users", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchUsers();
    }
  }, [isOpen, update]);

  const handleSelectUser = async (user: User) => {
    setSelectedUser(user);
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/user/${user.id}`);
      if (!res.ok) throw new Error("Failed to check user status");
      const data = await res.json() as any;

      if (data.exists) {
        setStep("password");
      } else {
        setStep("create");
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
      setSelectedUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === "new_user") {
      if (!newUserName || !password) return;
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newUserName, password }),
        });
        if (!res.ok) {
          const data = await res.json() as any;
          throw new Error(data.error || "Failed to create user");
        }
        const data = await res.json() as any;

        // Add to users list
        const newUser: User = { id: data.id, name: data.name, email: data.email, initials: data.initials };
        setUsers(prev => [...prev, newUser]);
        update(s => ({ ...s, users: [...s.users, newUser] }));

        onLogin(data.token, data.id);
      } catch (e: any) {
        setError(e.message || "An error occurred");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!selectedUser || !password) return;

    setIsLoading(true);
    setError("");

    try {
      if (step === "password") {
        const res = await fetch(`${API_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedUser.id, password }),
        });

        if (!res.ok) {
          const data = await res.json() as any;
          throw new Error(data.error || "Login failed");
        }

        const data = await res.json() as any;
        onLogin(data.token, selectedUser.id);

      } else if (step === "create") {
        const res = await fetch(`${API_URL}/api/user/${selectedUser.id}/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        if (!res.ok) {
          const data = await res.json() as any;
          throw new Error(data.error || "Failed to create password");
        }

        const data = await res.json() as any;
        onLogin(data.token, selectedUser.id);
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === "select" && "Who is signing in?"}
            {step === "password" && `Welcome back, ${selectedUser?.name}`}
            {step === "create" && `Welcome, ${selectedUser?.name}`}
            {step === "new_user" && "Create a new user"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "select" && "Select your profile or create a new one to continue"}
            {step === "password" && "Enter your password to access the workspace"}
            {step === "create" && "Create a password to secure your account"}
            {step === "new_user" && "Enter your name and a password"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {error && (
            <div className="mb-4 p-2 text-sm text-red-500 bg-red-500/10 rounded-md text-center">
              {error}
            </div>
          )}

          {step === "select" && (
            <div className="flex flex-col items-center justify-center mt-4">
              {users.length > 0 ? (
                <div className="flex justify-center gap-6 mb-8 flex-wrap">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      disabled={isLoading}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      <div className="size-20 rounded-full bg-primary/10 text-primary ring-2 ring-primary/20 flex items-center justify-center text-2xl font-semibold shadow-sm">
                        {u.initials}
                      </div>
                      <span className="font-medium text-sm">{u.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-6">No users found. Create one to get started.</p>
              )}

              <Button variant="outline" onClick={() => setStep("new_user")}>
                Create New User
              </Button>
            </div>
          )}

          {(step === "password" || step === "create" || step === "new_user") && (
            <form onSubmit={handleSubmit} className="space-y-4 px-4 mt-2">
              {step === "new_user" && (
                <div className="space-y-2 mb-4">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    autoFocus
                    required
                    disabled={isLoading}
                  />
                </div>
              )}
              <div className="space-y-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={step === "create" || step === "new_user" ? "Create a secure password" : "Enter your password"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  autoFocus={step !== "new_user"}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("select")}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={isLoading || !password || (step === "new_user" && !newUserName)}>
                  {isLoading ? "Please wait..." : step === "create" ? "Set Password & Login" : step === "new_user" ? "Create & Login" : "Sign In"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
