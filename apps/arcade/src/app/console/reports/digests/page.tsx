"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Clock, FileText, Play, Calendar, RefreshCw } from "lucide-react";

interface Digest {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  schedule: {
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay: string;
    timezone: string;
  };
  content: {
    sections: string[];
    compareToPrevious: boolean;
    highlightAnomalies: boolean;
  };
  recipients: string[];
  isActive: boolean;
  lastSentAt?: string;
  nextScheduledAt?: string;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC", "Europe/London", "Europe/Paris", "Asia/Tokyo"];

export default function ExecutiveDigestsPage() {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [newDigest, setNewDigest] = useState<Partial<Digest>>({
    frequency: "weekly",
    schedule: { timeOfDay: "09:00", timezone: "America/New_York", dayOfWeek: 1 },
    content: { sections: ["summary", "gates"], compareToPrevious: true, highlightAnomalies: true },
    recipients: [],
  });

  const fetchDigests = async () => {
    setIsLoading(true);
    const res = await fetch("/api/v1/reports/digests");
    const data = await res.json();
    setDigests(data.digests || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDigests();
  }, []);

  const handleCreate = async () => {
    if (!newDigest.name || !newDigest.recipients?.length) return;

    setCreating(true);
    const res = await fetch("/api/v1/reports/digests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDigest.name,
        frequency: newDigest.frequency,
        schedule: newDigest.schedule,
        content: newDigest.content,
        recipients: newDigest.recipients,
      }),
    });

    if (res.ok) {
      setNewDigest({
        frequency: "weekly",
        schedule: { timeOfDay: "09:00", timezone: "America/New_York", dayOfWeek: 1 },
        content: { sections: ["summary", "gates"], compareToPrevious: true, highlightAnomalies: true },
        recipients: [],
      });
      fetchDigests();
    }
    setCreating(false);
  };

  const handleGenerate = async (id: string) => {
    setGenerating(id);
    const res = await fetch(`/api/v1/reports/digests/${id}/generate`, { method: "POST" });
    if (res.ok) {
      fetchDigests();
    }
    setGenerating(null);
  };

  const formatTime = (iso?: string) => {
    return iso ? new Date(iso).toLocaleString() : "Never";
  };

  const toggleSection = (section: string) => {
    const current = newDigest.content?.sections || [];
    const updated = current.includes(section)
      ? current.filter(s => s !== section)
      : [...current, section];
    setNewDigest({ ...newDigest, content: { ...newDigest.content, sections: updated } as any });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Executive Reports</h1>
          <p className="text-muted-foreground">Schedule automated digests for stakeholders</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Mail className="w-4 h-4 mr-2" /> New Digest</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Executive Digest</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input 
                  value={newDigest.name || ""} 
                  onChange={(e) => setNewDigest({ ...newDigest, name: e.target.value })}
                  placeholder="Weekly Executive Summary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequency</Label>
                  <Select 
                    value={newDigest.frequency} 
                    onValueChange={(v) => setNewDigest({ ...newDigest, frequency: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Time</Label>
                  <Input 
                    type="time"
                    value={newDigest.schedule?.timeOfDay || "09:00"}
                    onChange={(e) => setNewDigest({ 
                      ...newDigest, 
                      schedule: { ...newDigest.schedule, timeOfDay: e.target.value } as any 
                    })}
                  />
                </div>
              </div>

              {newDigest.frequency === "weekly" && (
                <div>
                  <Label>Day of Week</Label>
                  <Select 
                    value={String(newDigest.schedule?.dayOfWeek || 1)}
                    onValueChange={(v) => setNewDigest({ 
                      ...newDigest, 
                      schedule: { ...newDigest.schedule, dayOfWeek: parseInt(v) } as any 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day, i) => (
                        <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Timezone</Label>
                <Select 
                  value={newDigest.schedule?.timezone || "America/New_York"}
                  onValueChange={(v) => setNewDigest({ 
                    ...newDigest, 
                    schedule: { ...newDigest.schedule, timezone: v } as any 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">Sections</Label>
                <div className="space-y-2">
                  {["summary", "gates", "signals", "audit", "compliance"].map((section) => (
                    <div key={section} className="flex items-center gap-2">
                      <Checkbox 
                        checked={newDigest.content?.sections?.includes(section)}
                        onCheckedChange={() => toggleSection(section)}
                      />
                      <span className="capitalize">{section}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={newDigest.content?.compareToPrevious}
                    onCheckedChange={(v) => setNewDigest({ 
                      ...newDigest, 
                      content: { ...newDigest.content, compareToPrevious: v as boolean } as any 
                    })}
                  />
                  <span>Compare to previous period</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={newDigest.content?.highlightAnomalies}
                    onCheckedChange={(v) => setNewDigest({ 
                      ...newDigest, 
                      content: { ...newDigest.content, highlightAnomalies: v as boolean } as any 
                    })}
                  />
                  <span>Highlight anomalies</span>
                </div>
              </div>

              <div>
                <Label>Recipients (comma-separated)</Label>
                <Input 
                  value={newDigest.recipients?.join(", ") || ""}
                  onChange={(e) => setNewDigest({ 
                    ...newDigest, 
                    recipients: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="exec@company.com, team@company.com"
                />
              </div>

              <Button 
                onClick={handleCreate} 
                disabled={creating || !newDigest.name || !newDigest.recipients?.length}
                className="w-full"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Create Digest"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : digests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No digests configured yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first scheduled report</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {digests.map((digest) => (
            <Card key={digest.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{digest.name}</h3>
                      <Badge variant={digest.isActive ? "default" : "secondary"}>
                        {digest.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {digest.frequency} at {digest.schedule.timeOfDay}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {digest.recipients.length} recipient{digest.recipients.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Last sent: {formatTime(digest.lastSentAt)}</span>
                      <span>•</span>
                      <span>Next: {formatTime(digest.nextScheduledAt)}</span>
                    </div>

                    <div className="flex gap-2 mt-2">
                      {digest.content.sections.map((section) => (
                        <Badge key={section} variant="outline" className="capitalize text-xs">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(digest.id)}
                    disabled={generating === digest.id}
                  >
                    {generating === digest.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Generate Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
