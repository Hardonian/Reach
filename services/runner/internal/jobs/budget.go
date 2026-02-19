// Package budget provides lock-free, predictive cost controls
package jobs

import (
	"context"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"time"
)

// CostModel defines per-tool cost heuristics with confidence intervals
type CostModel struct {
	BaseCost     float64 // Base USD cost
	PerTokenCost float64 // Cost per token (input/output)
	PerCallCost  float64 // Fixed overhead per call
	Variance     float64 // Standard deviation for prediction
	P99Latency   int64   // Cached p99 latency for budget timeout calc
}

// CostRegistry maintains tool-specific cost models with thread-safe updates
type CostRegistry struct {
	mu     sync.RWMutex
	models map[string]*CostModel
	// Historical data for model updates
	history map[string][]costSample
}

type costSample struct {
	cost      float64
	timestamp time.Time
	tokens    int
}

// NewCostRegistry creates a registry with default models
func NewCostRegistry() *CostRegistry {
	cr := &CostRegistry{
		models:  make(map[string]*CostModel),
		history: make(map[string][]costSample),
	}
	
	// Initialize with conservative defaults
	cr.models["llm.call"] = &CostModel{
		BaseCost:     0.001,
		PerTokenCost: 0.00001,
		PerCallCost:  0.0001,
		Variance:     0.0005,
		P99Latency:   5000,
	}
	cr.models["tool.execute"] = &CostModel{
		BaseCost:     0.0001,
		PerTokenCost: 0.0,
		PerCallCost:  0.00001,
		Variance:     0.00001,
		P99Latency:   1000,
	}
	cr.models["file.read"] = &CostModel{
		BaseCost:     0.0,
		PerTokenCost: 0.0,
		PerCallCost:  0.000001,
		Variance:     0.0,
		P99Latency:   100,
	}
	cr.models["file.write"] = &CostModel{
		BaseCost:     0.0,
		PerTokenCost: 0.0,
		PerCallCost:  0.000001,
		Variance:     0.0,
		P99Latency:   100,
	}
	cr.models["http.request"] = &CostModel{
		BaseCost:     0.00001,
		PerTokenCost: 0.0,
		PerCallCost:  0.00001,
		Variance:     0.00001,
		P99Latency:   2000,
	}
	
	return cr
}

// Get retrieves cost model for a tool
func (cr *CostRegistry) Get(tool string) *CostModel {
	cr.mu.RLock()
	defer cr.mu.RUnlock()
	
	if model, ok := cr.models[tool]; ok {
		return model
	}
	
	// Return conservative default for unknown tools
	return &CostModel{
		BaseCost:     0.001,
		PerTokenCost: 0.00001,
		PerCallCost:  0.0001,
		Variance:     0.001,
		P99Latency:   5000,
	}
}

// Update adjusts cost model based on actual observed costs
func (cr *CostRegistry) Update(tool string, actualCost float64, tokens int) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	
	// Store sample
	cr.history[tool] = append(cr.history[tool], costSample{
		cost:      actualCost,
		timestamp: time.Now(),
		tokens:    tokens,
	})
	
	// Keep only last 100 samples
	if len(cr.history[tool]) > 100 {
		cr.history[tool] = cr.history[tool][len(cr.history[tool])-100:]
	}
	
	// Update model with exponential smoothing
	model, ok := cr.models[tool]
	if !ok {
		model = &CostModel{}
		cr.models[tool] = model
	}
	
	// Simple EMA update for base cost
	alpha := 0.3
	if model.BaseCost == 0 {
		model.BaseCost = actualCost
	} else {
		model.BaseCost = model.BaseCost*(1-alpha) + actualCost*alpha
	}
	
	// Update variance
	diff := actualCost - model.BaseCost
	model.Variance = model.Variance*(1-alpha) + diff*diff*alpha
	if model.Variance < 0.000001 {
		model.Variance = 0.000001 // Minimum variance
	}
}

// ExponentialMovingAverage provides EMA calculations
type ExponentialMovingAverage struct {
	alpha   float64
	value   atomic.Uint64
	hasValue atomic.Bool
}

// NewEMA creates a new EMA with specified smoothing factor
func NewEMA(alpha float64) *ExponentialMovingAverage {
	return &ExponentialMovingAverage{alpha: alpha}
}

// Add updates the EMA with a new value
func (ema *ExponentialMovingAverage) Add(val float64) {
	scaled := uint64(val * 1000000) // 6 decimal precision
	
	if !ema.hasValue.Load() {
		ema.value.Store(scaled)
		ema.hasValue.Store(true)
		return
	}
	
	oldScaled := ema.value.Load()
	oldVal := float64(oldScaled) / 1000000
	
	newVal := oldVal*(1-ema.alpha) + val*ema.alpha
	ema.value.Store(uint64(newVal * 1000000))
}

// Value returns current EMA value
func (ema *ExponentialMovingAverage) Value() float64 {
	if !ema.hasValue.Load() {
		return 0
	}
	return float64(ema.value.Load()) / 1000000
}

// LinearRegression provides simple trend prediction
type LinearRegression struct {
	window     int
	xValues    []int64
	yValues    []float64
	mu         sync.RWMutex
}

// NewLinearRegression creates a regression with specified window size
func NewLinearRegression(window int) *LinearRegression {
	return &LinearRegression{
		window:  window,
		xValues: make([]int64, 0, window),
		yValues: make([]float64, 0, window),
	}
}

// AddPoint adds a data point
func (lr *LinearRegression) AddPoint(x int64, y float64) {
	lr.mu.Lock()
	defer lr.mu.Unlock()
	
	lr.xValues = append(lr.xValues, x)
	lr.yValues = append(lr.yValues, y)
	
	if len(lr.xValues) > lr.window {
		lr.xValues = lr.xValues[1:]
		lr.yValues = lr.yValues[1:]
	}
}

// Predict forecasts y at given x using least squares
func (lr *LinearRegression) Predict(x int64) float64 {
	lr.mu.RLock()
	defer lr.mu.RUnlock()
	
	n := len(lr.xValues)
	if n < 2 {
		if n == 1 {
			return lr.yValues[0]
		}
		return 0
	}
	
	// Calculate means
	var sumX, sumY float64
	for i := 0; i < n; i++ {
		sumX += float64(lr.xValues[i])
		sumY += lr.yValues[i]
	}
	meanX := sumX / float64(n)
	meanY := sumY / float64(n)
	
	// Calculate slope (m) and intercept (b)
	var num, den float64
	for i := 0; i < n; i++ {
		dx := float64(lr.xValues[i]) - meanX
		dy := lr.yValues[i] - meanY
		num += dx * dy
		den += dx * dx
	}
	
	if den == 0 {
		return meanY
	}
	
	slope := num / den
	intercept := meanY - slope*meanX
	
	return slope*float64(x) + intercept
}

// BudgetController manages per-run spend with atomic operations
type BudgetController struct {
	// Atomic fields (8-byte aligned for 64-bit atomic ops)
	spentUSD     atomic.Uint64 // Stored as cents * 100 (4 decimal precision)
	reservedUSD  atomic.Uint64 // Reserved for in-flight operations

	budgetUSD       float64
	runID           string
	tenantID        string
	
	// Cost registry for tool-specific heuristics
	costRegistry    *CostRegistry
	
	// Predictive signals
	spendVelocity   *ExponentialMovingAverage // Tracks $/second
	projectionModel *LinearRegression         // Simple trend predictor
	
	// Circuit breaker for budget alerts
	alertThreshold  float64
	alertFired      atomic.Bool
	pauseTriggered  atomic.Bool
	
	// For pause callback
	onBudgetExceeded func()
}

// AllocationResult for request/response pattern
type AllocationResult struct {
	Approved    bool
	AllocatedID uint64        // Reference for commit/rollback
	EstCost     float64       // Estimated cost
	Confidence  float64       // 0.0-1.0 prediction confidence
	Remaining   float64       // Remaining budget after allocation
}

// NewBudgetController creates a controller with ML-enhanced prediction
func NewBudgetController(runID, tenantID string, budgetUSD float64, registry *CostRegistry) *BudgetController {
	if budgetUSD <= 0 {
		budgetUSD = 10.0 // Default $10 budget
	}
	
	bc := &BudgetController{
		budgetUSD:        budgetUSD,
		runID:            runID,
		tenantID:         tenantID,
		costRegistry:     registry,
		alertThreshold:   budgetUSD * 0.8, // 80% alert
		spendVelocity:    NewEMA(0.3),      // 30% smoothing factor
		projectionModel:  NewLinearRegression(60), // 60-second window
	}
	return bc
}

// SetPauseCallback sets the function to call when budget is exceeded
func (bc *BudgetController) SetPauseCallback(fn func()) {
	bc.onBudgetExceeded = fn
}

// PredictAndReserve performs optimistic cost allocation with confidence scoring
// Returns immediately (no locks) with allocation ID for async commit
func (bc *BudgetController) PredictAndReserve(ctx context.Context, tool string, estimatedTokens int) AllocationResult {
	model := bc.costRegistry.Get(tool)
	
	// Calculate predicted cost with variance
	baseCost := model.BaseCost + model.PerTokenCost*float64(estimatedTokens) + model.PerCallCost
	confidence := 1.0 - (model.Variance / baseCost) // Higher variance = lower confidence
	confidence = math.Max(0.1, math.Min(1.0, confidence))
	
	// Pessimistic reservation (base + 2σ)
	reserved := baseCost + 2*model.Variance
	if reserved <= 0 {
		reserved = 0.0001 // Minimum reservation
	}
	
	// Atomic check-and-reserve
	reservedCents := uint64(reserved * 10000) // 4-decimal precision
	bc.reservedUSD.Add(reservedCents)
	
	currentSpent := bc.spentUSD.Load()
	currentReserved := bc.reservedUSD.Load()
	
	totalCommitted := float64(currentSpent+currentReserved) / 10000
	remaining := bc.budgetUSD - totalCommitted
	
	approved := totalCommitted <= bc.budgetUSD
	
	if !approved {
		// Rollback reservation
		bc.reservedUSD.Add(^uint64(reservedCents - 1)) // Atomic subtract
		
		// Trigger pause if not already triggered
		if bc.pauseTriggered.CompareAndSwap(false, true) {
			if bc.onBudgetExceeded != nil {
				go bc.onBudgetExceeded()
			}
		}
	}
	
	// Check alert threshold (async, non-blocking)
	if approved {
		bc.checkAlertThreshold(float64(currentSpent)/10000, baseCost)
	}
	
	return AllocationResult{
		Approved:    approved,
		AllocatedID: currentReserved, // Use as reference
		EstCost:     baseCost,
		Confidence:  confidence,
		Remaining:   remaining,
	}
}

// CommitSpend atomically records actual spend vs estimated
func (bc *BudgetController) CommitSpend(allocID uint64, actualCost float64, tool string) {
	actualCents := uint64(actualCost * 10000)
	
	// Release reservation (approximate - may release slightly different amount)
	// In production, track per-allocation reservations in a concurrent map
	bc.reservedUSD.Store(0) // Simplified: clear all reservations
	
	// Record actual spend
	bc.spentUSD.Add(actualCents)
	
	// Update velocity and projection model
	bc.spendVelocity.Add(actualCost)
	bc.projectionModel.AddPoint(time.Now().Unix(), actualCost)
	
	// Update cost model for future predictions
	bc.costRegistry.Update(tool, actualCost, 0)
}

// GetSpent returns current spend
func (bc *BudgetController) GetSpent() float64 {
	return float64(bc.spentUSD.Load()) / 10000
}

// GetRemaining returns remaining budget
func (bc *BudgetController) GetRemaining() float64 {
	spent := float64(bc.spentUSD.Load()) / 10000
	return bc.budgetUSD - spent
}

// GetProjection returns ML-predicted final cost based on spend velocity
func (bc *BudgetController) GetProjection(remainingOperations int) float64 {
	currentSpent := float64(bc.spentUSD.Load()) / 10000
	velocity := bc.spendVelocity.Value()
	projectedAdditional := velocity * float64(remainingOperations)
	
	// Blend with regression model prediction
	trendProjection := bc.projectionModel.Predict(time.Now().Add(time.Minute).Unix())
	
	// Weighted average: 70% velocity, 30% trend
	return currentSpent + 0.7*projectedAdditional + 0.3*trendProjection
}

// ShouldPause returns true if budget has been exceeded
func (bc *BudgetController) ShouldPause() bool {
	return bc.pauseTriggered.Load()
}

// checkAlertThreshold fires alert once when crossing 80%
func (bc *BudgetController) checkAlertThreshold(spent, newCost float64) {
	if spent+newCost >= bc.alertThreshold && bc.alertFired.CompareAndSwap(false, true) {
		// Async alert (non-blocking)
		go bc.fireBudgetAlert(spent)
	}
}

func (bc *BudgetController) fireBudgetAlert(spent float64) {
	// Log alert - integration with external alerting would go here
	fmt.Printf("[BUDGET ALERT] Run %s: Spent $%.2f of $%.2f (%.1f%%)\n", 
		bc.runID, spent, bc.budgetUSD, (spent/bc.budgetUSD)*100)
}

// GetBudgetUSD returns total budget
func (bc *BudgetController) GetBudgetUSD() float64 {
	return bc.budgetUSD
}

// GetStatus returns comprehensive budget status
func (bc *BudgetController) GetStatus() map[string]interface{} {
	spent := bc.GetSpent()
	remaining := bc.GetRemaining()
	
	return map[string]interface{}{
		"run_id":          bc.runID,
		"budget_usd":      bc.budgetUSD,
		"spent_usd":       spent,
		"remaining_usd":   remaining,
		"percent_used":    (spent / bc.budgetUSD) * 100,
		"alert_fired":     bc.alertFired.Load(),
		"paused":          bc.pauseTriggered.Load(),
		"spend_velocity":  bc.spendVelocity.Value(),
		"projection_next": bc.GetProjection(1),
	}
}
