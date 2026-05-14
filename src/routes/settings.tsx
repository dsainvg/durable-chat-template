import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { THEMES, applyTheme, type ThemeId } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { state, update } = useStore();
  const me = state.users.find((u) => u.id === state.currentUserId)!;
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [notifEmail, setNotifEmail] = useState(state.notificationsEmail);
  const [pw, setPw] = useState({ cur: "", next: "", confirm: "" });
  const [emailNotif, setEmailNotif] = useState(true);

  const saveProfile = async () => {
    const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

    // Save to backend
    const token = localStorage.getItem("syncduo_token");
    if (token) {
      try {
        await fetch(`/api/user/${me.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ name, email, initials })
        });
      } catch (e) {
        console.error("Failed to update profile on server", e);
      }
    }

    // Update local store
    update((s) => ({
      ...s,
      notificationsEmail: notifEmail,
      users: s.users.map((u) => (u.id === me.id ? { ...u, name, email, initials } : u)),
    }));
    toast.success("Profile saved");
  };

  const changePw = () => {
    if (!pw.next || pw.next !== pw.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setPw({ cur: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

  return (
    <div className="flex-1 overflow-auto">
      <header className="h-14 px-6 flex items-center border-b border-border bg-card/30">
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-10">
        <section>
          <h2 className="text-sm font-semibold mb-1">Theme</h2>
          <p className="text-xs text-muted-foreground mb-4">All themes are dark — pick the mood that fits today.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEMES.map((t) => {
              const active = state.theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    update((s) => ({ ...s, theme: t.id as ThemeId }));
                    applyTheme(t.id as ThemeId);
                  }}
                  className={`relative rounded-lg overflow-hidden ring-1 ${active ? "ring-2 ring-primary" : "ring-border"} transition-all`}
                >
                  <div className="h-20" style={{ background: t.swatch }}>
                    <div className="h-full flex items-end p-2">
                      <div className="size-2 rounded-full" style={{ background: t.accent }} />
                    </div>
                  </div>
                  <div className="bg-card px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-medium">{t.label}</span>
                    {active && <Check className="size-3.5 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-4">Profile</h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Notifications email</Label>
              <Input type="email" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">All reminders are mailed to this address.</p>
            </div>
            <Button onClick={saveProfile}>Save profile</Button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-4">Change password</h2>
          <div className="space-y-3 max-w-sm">
            <div>
              <Label className="text-xs">Current password</Label>
              <Input type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">New password</Label>
              <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Confirm new password</Label>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </div>
            <Button onClick={changePw}>Update password</Button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-4">Notifications</h2>
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <div>
              <p className="text-sm">Email me task updates</p>
              <p className="text-xs text-muted-foreground">Sent to {notifEmail}</p>
            </div>
            <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
          </div>
        </section>
      </div>
    </div>
  );
}
