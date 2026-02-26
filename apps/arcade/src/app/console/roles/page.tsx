"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, Plus } from "lucide-react";

const PERMISSIONS = [
  "read:*", "write:*", "delete:*",
  "read:gate", "write:gate", "delete:gate",
  "read:signal", "write:signal", "delete:signal",
  "read:audit", "read:compliance", "write:policy",
  "read:trace", "write:alert"
];

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newRole, setNewRole] = useState({ name: "", description: "", permissions: [] as string[] });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch("/api/v1/roles").then(r => r.json()).then(d => { setRoles(d.roles || []); setIsLoading(false); });
  }, []);

  const createRole = async () => {
    await fetch("/api/v1/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRole) });
    setDialogOpen(false);
    setNewRole({ name: "", description: "", permissions: [] });
    fetch("/api/v1/roles").then(r => r.json()).then(d => setRoles(d.roles || []));
  };

  const togglePermission = (perm: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm) ? prev.permissions.filter(p => p !== perm) : [...prev.permissions, perm]
    }));
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Custom roles and permission scopes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Create Role</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={newRole.name} onChange={e => setNewRole({ ...newRole, name: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={newRole.description} onChange={e => setNewRole({ ...newRole, description: e.target.value })} /></div>
              <div><Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-60 overflow-y-auto">
                  {PERMISSIONS.map(p => (
                    <label key={p} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent">
                      <input type="checkbox" checked={newRole.permissions.includes(p)} onChange={() => togglePermission(p)} />
                      <span className="text-sm">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={createRole} disabled={!newRole.name || newRole.permissions.length === 0} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? <div>Loading...</div> : roles.map(role => (
          <Card key={role.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${role.is_system_role ? 'bg-blue-100' : 'bg-purple-100'}`}>
                    {role.is_system_role ? <Shield className="w-5 h-5 text-blue-600" /> : <Users className="w-5 h-5 text-purple-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{role.name}</span>
                      {role.is_system_role && <Badge variant="secondary">System</Badge>}
                      {role.is_custom && <Badge variant="outline">Custom</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                    <div className="flex gap-1 mt-2">
                      {role.permissions?.slice(0, 5).map((p: string) => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                      {(role.permissions?.length || 0) > 5 && <Badge variant="outline" className="text-xs">+{role.permissions.length - 5}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{role.user_count || 0}</div>
                  <div className="text-sm text-muted-foreground">assigned</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
