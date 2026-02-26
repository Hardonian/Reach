"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, Clock, RefreshCw, XCircle, Mail, Slack, Webhook } from "lucide-react";

interface DeliveryLog {
  id: string;
  alertId: string;
  alertTitle: string;
  alertSeverity: string;
  channel: "email" | "slack" | "webhook" | "pagerduty" | "sms";
  recipient: string;
  status: "pending" | "sent" | "delivered" | "failed" | "bounced" | "suppressed";
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  error?: {
    code: string;
    message: string;
    category: string;
  };
  escalationTriggered: boolean;
  attemptedAt: string;
  completedAt?: string;
}

const channelIcons = {
  email: Mail,
  slack: Slack,
  webhook: Webhook,
  pagerduty: AlertCircle,
  sms: AlertCircle,
};

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500", label: "Pending" },
  sent: { icon: CheckCircle, color: "bg-blue-500", label: "Sent" },
  delivered: { icon: CheckCircle, color: "bg-green-500", label: "Delivered" },
  failed: { icon: XCircle, color: "bg-red-500", label: "Failed" },
  bounced: { icon: XCircle, color: "bg-orange-500", label: "Bounced" },
  suppressed: { icon: AlertCircle, color: "bg-gray-500", label: "Suppressed" },
};

export default function AlertDeliveryPage() {
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ channel: "", status: "" });
  const [retrying, setRetrying] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    failed: 0,
    pending: 0,
    delivered: 0,
  });

  const fetchDeliveries = async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filter.channel) params.set("channel", filter.channel);
    if (filter.status) params.set("status", filter.status);
    
    const res = await fetch(`/api/v1/alerts/delivery?${params}`);
    const data = await res.json();
    setDeliveries(data.deliveries || []);
    
    // Calculate stats
    const failed = (data.deliveries || []).filter((d: DeliveryLog) => 
      d.status === "failed" || d.status === "bounced"
    ).length;
    const pending = (data.deliveries || []).filter((d: DeliveryLog) => 
      d.status === "pending"
    ).length;
    const delivered = (data.deliveries || []).filter((d: DeliveryLog) => 
      d.status === "delivered"
    ).length;
    
    setStats({
      total: data.total || 0,
      failed,
      pending,
      delivered,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDeliveries();
  }, [filter]);

  const handleRetry = async (deliveryId: string) => {
    setRetrying(deliveryId);
    const res = await fetch("/api/v1/alerts/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    });
    
    if (res.ok) {
      // Refresh after short delay
      setTimeout(fetchDeliveries, 1000);
    }
    setRetrying(null);
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  const getErrorRecommendation = (category?: string) => {
    switch (category) {
      case "rate_limit": return "Will auto-retry after cooldown";
      case "network": return "Will auto-retry";
      case "auth": return "Check integration credentials";
      case "invalid_address": return "Verify recipient address";
      default: return "Manual intervention may be needed";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Alert Delivery Ledger</h1>
          <p className="text-muted-foreground">Track alert notifications, retries, and failures</p>
        </div>
        <Button onClick={fetchDeliveries} variant="outline" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Deliveries</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            <div className="text-sm text-muted-foreground">Delivered</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-muted-foreground">Failed/Bounced</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={filter.channel} onValueChange={(v: string) => setFilter(f => ({ ...f, channel: v }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="slack">Slack</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="pagerduty">PagerDuty</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filter.status} onValueChange={(v: string) => setFilter(f => ({ ...f, status: v }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Delivery List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No deliveries found</div>
          ) : (
            <div className="space-y-4">
              {deliveries.map((d) => {
                const StatusIcon = statusConfig[d.status].icon;
                const ChannelIcon = channelIcons[d.channel];
                
                return (
                  <div key={d.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusConfig[d.status].color}`}>
                      <StatusIcon className="w-5 h-5 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ChannelIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium truncate">{d.alertTitle || "Unknown Alert"}</span>
                        <Badge variant={d.alertSeverity === "critical" ? "destructive" : "secondary"}>
                          {d.alertSeverity}
                        </Badge>
                        {d.escalationTriggered && (
                          <Badge variant="destructive">Escalated</Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-1">
                        {d.channel} → {d.recipient}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Attempted: {formatTime(d.attemptedAt)}</span>
                        <span>•</span>
                        <span>Retry {d.retryCount}/{d.maxRetries}</span>
                      </div>

                      {d.error && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm">
                          <div className="font-medium text-red-700 dark:text-red-400">
                            {d.error.code}: {d.error.message}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {getErrorRecommendation(d.error.category)}
                          </div>
                        </div>
                      )}

                      {d.nextRetryAt && d.status !== "delivered" && (
                        <div className="mt-1 text-xs text-yellow-600">
                          Next retry: {formatTime(d.nextRetryAt)}
                        </div>
                      )}
                    </div>

                    {(d.status === "failed" || d.status === "bounced") && d.retryCount < d.maxRetries && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(d.id)}
                        disabled={retrying === d.id}
                      >
                        {retrying === d.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
