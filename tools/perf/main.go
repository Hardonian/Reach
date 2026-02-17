package main

import (
	"bufio"
	"flag"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
)

func main() {
	metricsURL := flag.String("metrics-url", "http://localhost:8080/metrics", "Runner metrics endpoint")
	maxTriggerP95 := flag.Float64("max-trigger-p95", 1.5, "Max allowed trigger p95 in seconds")
	maxApprovalP95 := flag.Float64("max-approval-p95", 1.2, "Max allowed approval p95 in seconds")
	maxReqP95 := flag.Float64("max-request-p95", 2.0, "Max allowed request p95 in seconds")
	flag.Parse()

	resp, err := http.Get(*metricsURL)
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

	resp2, _ := http.Get(*metricsURL)
	defer resp2.Body.Close()
	approvalP95 := findQuantile(resp2, `reach_approval_latency_seconds\{quantile="0.95"\} ([0-9.]+)`)

	resp3, _ := http.Get(*metricsURL)
	defer resp3.Body.Close()
	requestP95 := findMaxRequestP95(resp3)

	fmt.Printf("trigger_p95=%.6fs approval_p95=%.6fs request_max_p95=%.6fs\n", triggerP95, approvalP95, requestP95)

	failed := false
	if triggerP95 > *maxTriggerP95 {
		fmt.Printf("FAIL: trigger p95 %.3fs > %.3fs\n", triggerP95, *maxTriggerP95)
		failed = true
	}
	if approvalP95 > *maxApprovalP95 {
		fmt.Printf("FAIL: approval p95 %.3fs > %.3fs\n", approvalP95, *maxApprovalP95)
		failed = true
	}
	if requestP95 > *maxReqP95 {
		fmt.Printf("FAIL: request max p95 %.3fs > %.3fs\n", requestP95, *maxReqP95)
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
