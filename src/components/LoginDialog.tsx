import { useState, useEffect } from "react";
import { useStore, type User } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const API_URL = "";

const HARDCODED_USERS: User[] = [
  { id: "sai", name: "Sai", email: "sai@example.com", initials: "SA" },
  { id: "rups", name: "Rups", email: "rups@example.com", initials: "RU" },
];

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
  const [step, setStep] = useState<"select" | "password" | "create">("select");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Set users when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedUser(null);
      setStep("select");
      setPassword("");
      setShowPassword(false);
      setError("");
      setUsers(HARDCODED_USERS);
      update(s => ({ ...s, users: HARDCODED_USERS }));
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
          body: JSON.stringify({ 
            password,
            name: selectedUser.name,
            email: selectedUser.email,
            initials: selectedUser.initials
          }),
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
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "select" && "Select your profile to continue"}
            {step === "password" && "Enter your password to access the workspace"}
            {step === "create" && "Create a password to secure your account"}
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
              <div className="flex justify-center gap-6 mb-8 flex-wrap">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    disabled={isLoading}
                    className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-accent transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="size-20 rounded-full bg-primary/10 text-primary ring-2 ring-primary/20 flex items-center justify-center text-2xl font-semibold shadow-sm">
                      {isLoading && selectedUser?.id === u.id ? <Loader2 className="h-8 w-8 animate-spin" /> : u.initials}
                    </div>
                    <span className="font-medium text-sm">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(step === "password" || step === "create") && (
            <form onSubmit={handleSubmit} className="space-y-4 px-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={step === "create" ? "Create a secure password" : "Enter your password"}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    autoFocus
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-r-md disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading || !password}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
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
                <Button type="submit" disabled={isLoading || !password}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Please wait...
                    </>
                  ) : step === "create" ? (
                    "Set Password & Login"
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
