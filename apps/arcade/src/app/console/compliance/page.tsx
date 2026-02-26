"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Shield, CheckCircle } from "lucide-react";

export default function CompliancePage() {
  const [exports, setExports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newExport, setNewExport] = useState({ name: "", exportType: "full_compliance", dateFrom: "", dateTo: "" });

  useEffect(() => {
    fetch("/api/v1/compliance/exports").then(r => r.json()).then(d => { setExports(d.exports || []); setIsLoading(false); });
  }, []);

  const createExport = async () => {
    await fetch("/api/v1/compliance/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newExport) });
    setDialogOpen(false);
    fetch("/api/v1/compliance/exports").then(r => r.json()).then(d => setExports(d.exports || []));
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Compliance Exports</h1>
          <p className="text-muted-foreground">Signed audit bundles for security reviews</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><FileText className="w-4 h-4 mr-2" />New Export</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Compliance Export</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={newExport.name} onChange={e => setNewExport({ ...newExport, name: e.target.value })} /></div>
              <div><Label>Type</Label>
                <Select value={newExport.exportType} onValueChange={v => setNewExport({ ...newExport, exportType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_compliance">Full Compliance</SelectItem>
                    <SelectItem value="audit">Audit Log Only</SelectItem>
                    <SelectItem value="policy">Policy History</SelectItem>
                    <SelectItem value="gate_history">Gate History</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>From</Label><Input type="date" value={newExport.dateFrom} onChange={e => setNewExport({ ...newExport, dateFrom: e.target.value })} /></div>
                <div><Label>To</Label><Input type="date" value={newExport.dateTo} onChange={e => setNewExport({ ...newExport, dateTo: e.target.value })} /></div>
              </div>
              <Button onClick={createExport} disabled={!newExport.name || !newExport.dateFrom || !newExport.dateTo} className="w-full">Create Export</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? <div>Loading...</div> : exports.length === 0 ? <div className="text-muted-foreground">No exports yet</div> : exports.map(e => (
          <Card key={e.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    {e.status === 'ready' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Shield className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{e.name}</span>
                      <Badge variant={e.status === 'ready' ? 'default' : 'secondary'}>{e.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{e.export_type} • {e.date_from} to {e.date_to}</div>
                    <div className="text-xs text-muted-foreground mt-1">Hash: {e.verification_hash?.slice(0, 16)}...</div>
                  </div>
                </div>
                {e.status === 'ready' && (
                  <Button size="sm" variant="outline"><Download className="w-4 h-4 mr-1" />Download</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
