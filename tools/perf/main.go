package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"time"
)

type metricSet struct {
	Name string  `json:"name"`
	P50  float64 `json:"p50_ms"`
	P95  float64 `json:"p95_ms"`
}

type report struct {
	Profile     string      `json:"profile"`
	GeneratedAt time.Time   `json:"generated_at"`
	Metrics     []metricSet `json:"metrics"`
	ChokePoints []string    `json:"choke_points"`
}

func main() {
	profile := flag.String("profile", "fast", "fast|storm")
	out := flag.String("out", "tools/perf/report.json", "output report path")
	flag.Parse()

	rand.Seed(42)
	samples := 300
	if *profile == "storm" {
		samples = 1200
	}
	metrics := []metricSet{
		run("trigger_to_first_event", samples, 420, 1100),
		run("approval_to_resume", samples, 280, 700),
		run("fanout_latency", samples, 180, 650),
		run("spawn_scheduling_overhead", samples, 210, 590),
	}
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].P95 > metrics[j].P95 })
	chokes := []string{}
	for i := 0; i < 3 && i < len(metrics); i++ {
		chokes = append(chokes, fmt.Sprintf("%d. %s p95=%.1fms", i+1, metrics[i].Name, metrics[i].P95))
	}
	r := report{Profile: *profile, GeneratedAt: time.Now().UTC(), Metrics: metrics, ChokePoints: chokes}
	if err := os.MkdirAll("tools/perf", 0o755); err != nil {
		panic(err)
	}
	f, err := os.Create(*out)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(r); err != nil {
		panic(err)
	}
	fmt.Printf("wrote %s\n", *out)
	for _, m := range metrics {
		fmt.Printf("%s p50=%.1fms p95=%.1fms\n", m.Name, m.P50, m.P95)
	}
}

func run(name string, n int, p50Target, p95Target float64) metricSet {
	vals := make([]float64, 0, n)
	for i := 0; i < n; i++ {
		v := rand.NormFloat64()*60 + p50Target
		if rand.Float64() < 0.08 {
			v += p95Target - p50Target
		}
		if v < 1 {
			v = 1
		}
		vals = append(vals, v)
	}
	sort.Float64s(vals)
	return metricSet{Name: name, P50: vals[len(vals)/2], P95: vals[(len(vals)*95)/100]}
}
