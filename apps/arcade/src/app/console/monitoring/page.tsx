"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, TrendingUp, Target } from "lucide-react";

export default function MonitoringPage() {
  const [slos, setSlos] = useState<any[]>([]);
  const [trends, setTrends] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/monitoring/slo").then(r => r.json()).then(d => setSlos(d.slos || []));
    fetch("/api/v1/monitoring/trends?hours=24").then(r => r.json()).then(d => { setTrends(d.trends || {}); setIsLoading(false); });
  }, []);

  const formatTrend = (data: any[]) => {
    if (!data || data.length < 2) return { change: 0, direction: 'flat' };
    const first = data[0].v, last = data[data.length - 1].v;
    const change = first === 0 ? 0 : ((last - first) / first) * 100;
    return { change: Math.abs(change).toFixed(1), direction: change >= 0 ? 'up' : 'down' };
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Monitoring & SLOs</h1>
          <p className="text-muted-foreground">Service level objectives and trend analysis</p>
        </div>
        <Button onClick={() => window.location.reload()}><Activity className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{slos.length}</div>
            <div className="text-sm text-muted-foreground">Active SLOs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{slos.filter(s => s.latestMeasurement?.is_breaching).length}</div>
            <div className="text-sm text-red-500">Breaching</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{Object.keys(trends).length}</div>
            <div className="text-sm text-muted-foreground">Metrics Tracked</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{slos.filter(s => (s.latestMeasurement?.error_budget_burn_rate || 0) > 1).length}</div>
            <div className="text-sm text-yellow-500">Fast Burn</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="w-5 h-5" />SLO Status</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <div>Loading...</div> : slos.length === 0 ? <div className="text-muted-foreground">No SLOs defined</div> : (
              <div className="space-y-3">
                {slos.map(slo => (
                  <div key={slo.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{slo.name}</div>
                      <div className="text-xs text-muted-foreground">{slo.metric_type} • {slo.target_value}{slo.target_unit}</div>
                    </div>
                    <div className="text-right">
                      {slo.latestMeasurement?.is_breaching ? (
                        <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Breaching</Badge>
                      ) : (
                        <Badge variant="default">Healthy</Badge>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Burn: {slo.latestMeasurement?.error_budget_burn_rate?.toFixed(2) || 'N/A'}x
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />24h Trends</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <div>Loading...</div> : Object.keys(trends).length === 0 ? <div className="text-muted-foreground">No trend data</div> : (
              <div className="space-y-3">
                {Object.entries(trends).slice(0, 5).map(([name, data]) => {
                  const trend = formatTrend(data);
                  return (
                    <div key={name} className="flex items-center justify-between p-2 border-b last:border-0">
                      <span className="font-medium capitalize">{name.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <span className={trend.direction === 'up' ? 'text-green-500' : trend.direction === 'down' ? 'text-red-500' : 'text-gray-500'}>
                          {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.change}%
                        </span>
                        <span className="text-xs text-muted-foreground">({data.length} pts)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
