import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, Key } from "lucide-react";

export function ApiKeysDialog({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const { state } = useStore();
  const [keys, setKeys] = useState<{key: string, created_at: number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const token = localStorage.getItem("syncduo_token");

  useEffect(() => {
    if (isOpen && token) {
      fetchKeys();
    }
  }, [isOpen, token]);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apikeys", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as {key: string, created_at: number}[];
        setKeys(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const generateKey = async () => {
    try {
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as {key: string};
        setNewKey(data.key);
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const revokeKey = async (key: string) => {
    try {
      const res = await fetch(`/api/apikeys/${key}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>API Keys</DialogTitle>
          <DialogDescription>
            Manage your API keys for programmatic access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Button onClick={generateKey} className="w-full">
            <Key className="w-4 h-4 mr-2" />
            Generate New API Key
          </Button>

          {newKey && (
            <div className="p-3 bg-muted rounded-md text-sm break-all flex items-center justify-between border border-primary/50">
              <span className="font-mono">{newKey}</span>
              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(newKey)} aria-label="Copy key">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium">Active Keys</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API keys generated.</p>
            ) : (
              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-md border text-sm">
                    <div className="flex flex-col">
                      <span className="font-mono font-medium truncate w-[250px]">{k.key.substring(0, 8)}...{k.key.slice(-4)}</span>
                      <span className="text-xs text-muted-foreground">Created {new Date(k.created_at).toLocaleDateString()}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => revokeKey(k.key)} className="text-destructive hover:bg-destructive/10" aria-label="Revoke key">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
