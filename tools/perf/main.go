package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Deterministic seed for reproducibility - satisfies AGENTS.md determinism requirement
func init() {
	rand.Seed(42)
}

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
	profile := flag.String("profile", "", "fast|storm; when set, emit synthetic perf report JSON")
	out := flag.String("out", "tools/perf/report.json", "output report path for --profile mode")
	metricsURL := flag.String("metrics-url", "", "runner metrics endpoint for live perf gate mode")
	maxTriggerP95 := flag.Float64("max-trigger-p95", 1.5, "max allowed trigger p95 in seconds")
	maxApprovalP95 := flag.Float64("max-approval-p95", 1.2, "max allowed approval p95 in seconds")
	maxReqP95 := flag.Float64("max-request-p95", 2.0, "max allowed request p95 in seconds")
	flag.Parse()

	switch {
	case strings.TrimSpace(*metricsURL) != "":
		runLiveGate(*metricsURL, *maxTriggerP95, *maxApprovalP95, *maxReqP95)
	case strings.TrimSpace(*profile) != "":
		runSyntheticReport(*profile, *out)
	default:
		fmt.Fprintln(os.Stderr, "must provide either --profile or --metrics-url")
		os.Exit(1)
	}
}

func runSyntheticReport(profile, out string) {
	rand.Seed(42)
	samples := 300
	if profile == "storm" {
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
	r := report{Profile: profile, GeneratedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), Metrics: metrics, ChokePoints: chokes}
	if err := os.MkdirAll("tools/perf", 0o755); err != nil {
		panic(err)
	}
	f, err := os.Create(out)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(r); err != nil {
		panic(err)
	}
	fmt.Printf("wrote %s\n", out)
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

func runLiveGate(metricsURL string, maxTriggerP95, maxApprovalP95, maxReqP95 float64) {
	resp, err := http.Get(metricsURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to fetch metrics: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		fmt.Fprintf(os.Stderr, "metrics endpoint returned %d\n", resp.StatusCode)
		os.Exit(1)
	}

	triggerP95 := findQuantile(resp, `reach_trigger_latency_seconds\{quantile="0.95"\} ([0-9.]+)`)

	resp2, err := http.Get(metricsURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to fetch metrics: %v\n", err)
		os.Exit(1)
	}
	defer resp2.Body.Close()
	approvalP95 := findQuantile(resp2, `reach_approval_latency_seconds\{quantile="0.95"\} ([0-9.]+)`)

	resp3, err := http.Get(metricsURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to fetch metrics: %v\n", err)
		os.Exit(1)
	}
	defer resp3.Body.Close()
	requestP95 := findMaxRequestP95(resp3)

	fmt.Printf("trigger_p95=%.6fs approval_p95=%.6fs request_max_p95=%.6fs\n", triggerP95, approvalP95, requestP95)

	failed := false
	if triggerP95 > maxTriggerP95 {
		fmt.Printf("FAIL: trigger p95 %.3fs > %.3fs\n", triggerP95, maxTriggerP95)
		failed = true
	}
	if approvalP95 > maxApprovalP95 {
		fmt.Printf("FAIL: approval p95 %.3fs > %.3fs\n", approvalP95, maxApprovalP95)
		failed = true
	}
	if requestP95 > maxReqP95 {
		fmt.Printf("FAIL: request max p95 %.3fs > %.3fs\n", requestP95, maxReqP95)
		failed = true
	}
	if failed {
		os.Exit(2)
	}
	fmt.Println("PASS: perf thresholds within budget")
}

func findQuantile(resp *http.Response, pattern string) float64 {
	re := regexp.MustCompile(pattern)
	s := bufio.NewScanner(resp.Body)
	for s.Scan() {
		m := re.FindStringSubmatch(strings.TrimSpace(s.Text()))
		if len(m) == 2 {
			v, _ := strconv.ParseFloat(m[1], 64)
			return v
		}
	}
	return 0
}

func findMaxRequestP95(resp *http.Response) float64 {
	re := regexp.MustCompile(`reach_request_duration_seconds\{.*quantile="0.95"\} ([0-9.]+)`)
	max := 0.0
	s := bufio.NewScanner(resp.Body)
	for s.Scan() {
		m := re.FindStringSubmatch(strings.TrimSpace(s.Text()))
		if len(m) != 2 {
			continue
		}
		v, _ := strconv.ParseFloat(m[1], 64)
		if v > max {
			max = v
		}
	}
	return max
}
