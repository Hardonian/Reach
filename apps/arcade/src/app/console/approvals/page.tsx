"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Shield } from "lucide-react";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/v1/approvals?status=${filter}`).then(r => r.json()).then(d => { setApprovals(d.approvals || []); setIsLoading(false); });
  }, [filter]);

  const respond = async (id: string, action: 'approved' | 'rejected') => {
    await fetch(`/api/v1/approvals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action }) });
    fetch(`/api/v1/approvals?status=${filter}`).then(r => r.json()).then(d => setApprovals(d.approvals || []));
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Approval Requests</h1>
          <p className="text-muted-foreground">High-impact change governance</p>
        </div>
        <div className="flex gap-2">
          {["pending", "approved", "rejected"].map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? <div>Loading...</div> : approvals.length === 0 ? <div className="text-muted-foreground">No {filter} approvals</div> : approvals.map(a => (
          <Card key={a.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.action} {a.resource_type}</span>
                      <Badge variant={a.risk_level === 'critical' ? 'destructive' : a.risk_level === 'high' ? 'default' : 'secondary'}>{a.risk_level}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.impact_summary}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Requested by: {a.requester_email}</span>
                      <span>{new Date(a.requested_at).toLocaleString()}</span>
                      {a.role_name && <span>Requires: {a.role_name}</span>}
                    </div>
                  </div>
                </div>
                {filter === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => respond(a.id, 'rejected')}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                    <Button size="sm" onClick={() => respond(a.id, 'approved')}><CheckCircle className="w-4 h-4 mr-1" />Approve</Button>
                  </div>
                )}
                {filter !== "pending" && (
                  <Badge variant={a.status === 'approved' ? 'default' : 'secondary'} className="capitalize">{a.status}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
