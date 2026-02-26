"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle, Radio } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-gray-500"
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  detected: <Radio className="w-4 h-4 text-red-500 animate-pulse" />,
  investigating: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  mitigating: <Clock className="w-4 h-4 text-blue-500" />,
  monitoring: <Clock className="w-4 h-4 text-blue-400" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-500" />,
  postmortem: <CheckCircle className="w-4 h-4 text-green-400" />
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: "", description: "", severity: "high", affectedServices: [] });

  useEffect(() => {
    fetch("/api/v1/incidents").then(r => r.json()).then(d => { setIncidents(d.incidents || []); setIsLoading(false); });
  }, []);

  const createIncident = async () => {
    await fetch("/api/v1/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newIncident) });
    setDialogOpen(false);
    setNewIncident({ title: "", description: "", severity: "high", affectedServices: [] });
    fetch("/api/v1/incidents").then(r => r.json()).then(d => setIncidents(d.incidents || []));
  };

  const activeCount = incidents.filter(i => i.status !== 'resolved' && i.status !== 'postmortem').length;

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Incident Management</h1>
          <p className="text-muted-foreground">{activeCount} active incidents</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} variant="destructive"><AlertTriangle className="w-4 h-4 mr-2" />Declare Incident</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Declare New Incident</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newIncident.title} onChange={e => setNewIncident({ ...newIncident, title: e.target.value })} placeholder="Brief description" /></div>
            <div><Label>Description</Label><Input value={newIncident.description} onChange={e => setNewIncident({ ...newIncident, description: e.target.value })} placeholder="Detailed description" /></div>
            <div><Label>Severity</Label>
              <Select value={newIncident.severity} onValueChange={v => setNewIncident({ ...newIncident, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createIncident} disabled={!newIncident.title} className="w-full">Declare Incident</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {isLoading ? <div>Loading...</div> : incidents.length === 0 ? <div className="text-muted-foreground">No incidents</div> : incidents.map(incident => (
          <Card key={incident.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-3 h-3 rounded-full mt-2 ${SEVERITY_COLORS[incident.severity]}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      {STATUS_ICONS[incident.status]}
                      <span className="font-semibold">{incident.title}</span>
                      <Badge variant={incident.severity === 'critical' ? 'destructive' : 'secondary'}>{incident.severity}</Badge>
                      <Badge variant="outline">{incident.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Detected: {new Date(incident.detected_at).toLocaleString()}</span>
                      {incident.lead_responder && <span>Lead: {incident.lead_responder}</span>}
                    </div>
                    {incident.recentUpdates?.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <div className="text-xs font-medium text-gray-500">Latest Update</div>
                        <div className="text-sm">{incident.recentUpdates[0].message}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
