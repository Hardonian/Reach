package evaluation

import (
	"fmt"
	"sync"
)

// RetrievalMetrics tracks analytics for the RAG system.
type RetrievalMetrics struct {
	TotalQueries       int            `json:"total_queries"`
	HitRate            float64        `json:"hit_rate"`
	EmptyRetrievals    int            `json:"empty_retrievals"`
	CitationMismatches int            `json:"citation_mismatches"`
	MissedQueries      []string       `json:"missed_queries"`
	UsageByNamespace   map[string]int `json:"usage_by_namespace"`

	mu sync.RWMutex
}

// AnalyticsModule manages retrieval tracking.
type AnalyticsModule struct {
	metrics RetrievalMetrics
}

// NewAnalyticsModule creates a new analytics tracker.
func NewAnalyticsModule() *AnalyticsModule {
	return &AnalyticsModule{
		metrics: RetrievalMetrics{
			UsageByNamespace: make(map[string]int),
		},
	}
}

// RecordRetrieval logs a retrieval event.
func (a *AnalyticsModule) RecordRetrieval(query string, namespace string, hit bool, chunksCount int, citationMismatch bool) {
	a.metrics.mu.Lock()
	defer a.metrics.mu.Unlock()

	a.metrics.TotalQueries++
	if hit {
		// Update rolling average for hit rate
		a.metrics.HitRate = (a.metrics.HitRate*float64(a.metrics.TotalQueries-1) + 1.0) / float64(a.metrics.TotalQueries)
	} else {
		a.metrics.HitRate = (a.metrics.HitRate * float64(a.metrics.TotalQueries-1)) / float64(a.metrics.TotalQueries)
		a.metrics.MissedQueries = append(a.metrics.MissedQueries, query)
	}

	if chunksCount == 0 {
		a.metrics.EmptyRetrievals++
	}

	if citationMismatch {
		a.metrics.CitationMismatches++
	}

	a.metrics.UsageByNamespace[namespace]++
}

// GetSuggestions generates RAG tuning recommendations.
func (a *AnalyticsModule) GetSuggestions() []string {
	a.metrics.mu.RLock()
	defer a.metrics.mu.RUnlock()

	var suggestions []string
	if a.metrics.HitRate < 0.7 {
		suggestions = append(suggestions, "Overall hit rate is low (<70%). Consider increasing chunkSize or overlap.")
	}
	if a.metrics.EmptyRetrievals > a.metrics.TotalQueries/10 {
		suggestions = append(suggestions, "High rate of empty retrievals detected. Verify Knowledge Base indexing.")
	}
	if a.metrics.CitationMismatches > 0 {
		suggestions = append(suggestions, fmt.Sprintf("Detected %d citation mismatches. Tune prompt templates for grounding.", a.metrics.CitationMismatches))
	}

	return suggestions
}
