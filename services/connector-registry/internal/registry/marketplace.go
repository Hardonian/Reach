package registry

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"reach/internal/packkit/config"
	"reach/internal/packkit/manifest"
	packregistry "reach/internal/packkit/registry"
	"reach/internal/packkit/resolver"
	"reach/internal/packkit/signing"
)

const (
	defaultMarketplacePageSize = 25
	maxMarketplacePageSize     = 100
	catalogTTL                 = 2 * time.Minute
	catalogMaxItems            = 5000
)

type Publisher struct {
	Name     string `json:"name"`
	KeyID    string `json:"key_id"`
	Verified bool   `json:"verified"`
}

type MarketplaceVersion struct {
	Version        string `json:"version"`
	PublishedAt    string `json:"published_at"`
	SHA256         string `json:"sha256"`
	Signed         bool   `json:"signed"`
	SignatureKeyID string `json:"signature_key_id"`
}

type MarketplaceItem struct {
	Kind                 string               `json:"kind"`
	ID                   string               `json:"id"`
	Name                 string               `json:"name"`
	Description          string               `json:"description"`
	Publisher            Publisher            `json:"publisher"`
	Versions             []MarketplaceVersion `json:"versions"`
	LatestVersion        string               `json:"latest_version"`
	RiskLevel            string               `json:"risk_level"`
	TierRequired         string               `json:"tier_required"`
	RequiredCapabilities []string             `json:"required_capabilities"`
	SideEffectTypes      []string             `json:"side_effect_types"`
	Tags                 []string             `json:"tags"`
	Categories           []string             `json:"categories"`
	DocsURL              string               `json:"docs_url,omitempty"`
	RepoURL              string               `json:"repo_url,omitempty"`
	Changelog            string               `json:"changelog,omitempty"`
}

type CatalogFilter struct {
	Query      string
	Kind       string
	Risk       string
	Tier       string
	Capability string
	Tag        string
	Publisher  string
	Sort       string
	Page       int
	PageSize   int
	Verified   bool
}

type CatalogPage struct {
	Items    []MarketplaceItem `json:"items"`
	Total    int               `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"page_size"`
}

type InstallIntentRequest struct {
	Kind    string `json:"kind"`
	ID      string `json:"id"`
	Version string `json:"version,omitempty"`
}

type InstallRequestV1 struct {
	Kind                 string   `json:"kind"`
	ID                   string   `json:"id"`
	Version              string   `json:"version"`
	IdempotencyKey       string   `json:"idempotency_key"`
	AcceptedCapabilities []string `json:"accepted_capabilities"`
	AcceptedRisk         bool     `json:"accepted_risk"`
}

type InstallIntentResponse struct {
	Kind               string             `json:"kind"`
	ID                 string             `json:"id"`
	ResolvedVersion    string             `json:"resolved_version"`
	IdempotencyKey     string             `json:"idempotency_key"`
	ManifestSummary    manifest.Manifest  `json:"manifest_summary"`
	PermissionsSummary PermissionsSummary `json:"permissions_summary"`
	Signature          SignatureSummary   `json:"signature"`
	Publisher          Publisher          `json:"publisher"`
	Tier               TierSummary        `json:"tier"`
}

type PermissionsSummary struct {
	RequiredCapabilities []string `json:"required_capabilities"`
	SideEffectTypes      []string `json:"side_effect_types"`
	RiskLevel            string   `json:"risk_level"`
}

type SignatureSummary struct {
	Signed       bool   `json:"signed"`
	Verified     bool   `json:"verified"`
	SignatureKey string `json:"signature_key_id,omitempty"`
	Status       string `json:"status"`
}

type TierSummary struct {
	Required string `json:"required"`
	Allowed  bool   `json:"allowed"`
	Current  string `json:"current"`
}

type catalogCacheEntry struct {
	items        []MarketplaceItem
	etag         string
	modified     string
	expiresAt    time.Time
	sourceDigest string
}

func (s *Store) ListMarketplaceCatalog(ctx context.Context, filter CatalogFilter) (CatalogPage, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = defaultMarketplacePageSize
	}
	if filter.PageSize > maxMarketplacePageSize {
		filter.PageSize = maxMarketplacePageSize
	}
	items, err := s.marketplaceCatalog(ctx)
	if err != nil {
		return CatalogPage{}, err
	}
	filtered := make([]MarketplaceItem, 0, len(items))
	for _, item := range items {
		if !matchesFilter(item, filter) {
			continue
		}
		filtered = append(filtered, item)
	}
	sortMarketplace(filtered, filter.Sort)
	total := len(filtered)
	start := (filter.Page - 1) * filter.PageSize
	if start > total {
		start = total
	}
	end := min(start+filter.PageSize, total)
	return CatalogPage{Items: filtered[start:end], Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *Store) GetMarketplaceItem(ctx context.Context, kind, id string) (MarketplaceItem, error) {
	items, err := s.marketplaceCatalog(ctx)
	if err != nil {
		return MarketplaceItem{}, err
	}
	for _, item := range items {
		if item.Kind == kind && item.ID == id {
			return item, nil
		}
	}
	return MarketplaceItem{}, fmt.Errorf("item not found: %s/%s", kind, id)
}

func (s *Store) InstallIntent(ctx context.Context, req InstallIntentRequest) (InstallIntentResponse, error) {
	if req.ID == "" {
		return InstallIntentResponse{}, fmt.Errorf("id required")
	}
	if req.Kind == "" {
		req.Kind = "connector"
	}
	if req.Version == "" {
		req.Version = ">=0.0.0"
	}
	item, err := s.GetMarketplaceItem(ctx, req.Kind, req.ID)
	if err != nil {
		return InstallIntentResponse{}, err
	}
	idx, err := s.readIndex(ctx)
	if err != nil {
		return InstallIntentResponse{}, err
	}
	pkg, err := resolver.ResolvePackage(req.ID, req.Version, idx)
	if err != nil {
		return InstallIntentResponse{}, err
	}
	manifestBytes, sigBytes, err := s.readManifestAndSig(ctx, pkg)
	if err != nil {
		return InstallIntentResponse{}, err
	}
	m, err := manifest.ParseManifest(manifestBytes)
	if err != nil {
		return InstallIntentResponse{}, err
	}
	sigSummary := s.signatureSummary(manifestBytes, sigBytes, pkg.SignatureKeyID)
	if item.TierRequired == "" {
		item.TierRequired = pkg.TierRequired
	}

	key := generateIdempotencyKey()
	resp := InstallIntentResponse{
		Kind:            req.Kind,
		ID:              req.ID,
		ResolvedVersion: pkg.Version,
		IdempotencyKey:  key,
		ManifestSummary: m,
		PermissionsSummary: PermissionsSummary{
			RequiredCapabilities: append([]string{}, m.RequiredCapabilities...),
			SideEffectTypes:      append([]string{}, m.SideEffectTypes...),
			RiskLevel:            m.RiskLevel,
		},
		Signature: sigSummary,
		Publisher: item.Publisher,
		Tier: TierSummary{
			Required: item.TierRequired,
			Allowed:  tierAllowed(s.currentTier, item.TierRequired),
			Current:  s.currentTier,
		},
	}

	s.mu.Lock()
	s.installIntents[key] = intentEntry{response: resp, expiresAt: time.Now().Add(10 * time.Minute)}
	s.mu.Unlock()

	return resp, nil
}

func (s *Store) InstallMarketplace(ctx context.Context, req InstallRequestV1) (InstalledConnector, error) {
	return s.completeMarketplaceInstall(ctx, req, false)
}

func (s *Store) UpdateMarketplace(ctx context.Context, req InstallRequestV1) (InstalledConnector, error) {
	return s.completeMarketplaceInstall(ctx, req, true)
}

func (s *Store) completeMarketplaceInstall(_ context.Context, req InstallRequestV1, allowUpgrade bool) (InstalledConnector, error) {
	if req.ID == "" || req.Kind == "" || req.Version == "" || req.IdempotencyKey == "" {
		return InstalledConnector{}, fmt.Errorf("kind, id, version, and idempotency_key are required")
	}
	if !req.AcceptedRisk {
		return InstalledConnector{}, errors.New("risk acceptance required")
	}

	s.mu.Lock()
	entry, ok := s.installIntents[req.IdempotencyKey]
	if !ok {
		s.mu.Unlock()
		return InstalledConnector{}, fmt.Errorf("invalid or expired idempotency_key")
	}
	// Validate intent matches request
	if entry.response.ID != req.ID || entry.response.Kind != req.Kind || entry.response.ResolvedVersion != req.Version {
		s.mu.Unlock()
		return InstalledConnector{}, fmt.Errorf("request does not match intent for this key")
	}
	// Check expiration
	if time.Now().After(entry.expiresAt) {
		delete(s.installIntents, req.IdempotencyKey)
		s.mu.Unlock()
		return InstalledConnector{}, fmt.Errorf("idempotency_key expired")
	}
	// Commit to consuming this key
	delete(s.installIntents, req.IdempotencyKey)
	s.mu.Unlock()

	// Use intent data for validation to ensure WYSIWYG
	intent := entry.response
	if !tierAllowed(intent.Tier.Current, intent.Tier.Required) {
		return InstalledConnector{}, fmt.Errorf("item requires %s tier; current plan is %s", intent.Tier.Required, intent.Tier.Current)
	}

	missing := missingCapabilities(intent.PermissionsSummary.RequiredCapabilities, req.AcceptedCapabilities)
	if len(missing) > 0 {
		return InstalledConnector{}, fmt.Errorf("capability acceptance mismatch, missing: %s", strings.Join(missing, ","))
	}

	// We re-verify signature/hash during actual install via s.Install calling installResolved,
	// checking against the repo again. This is safer than trusting the intent cache implicitly for the bytes.
	// But we must ensure specific version.
	return s.Install(InstallRequest{ID: req.ID, Version: "=" + req.Version, AllowUpgrade: allowUpgrade})
}

func (s *Store) marketplaceCatalog(ctx context.Context) ([]MarketplaceItem, error) {
	s.mu.Lock()
	cache := s.catalogCache
	if len(cache.items) > 0 && time.Now().Before(cache.expiresAt) {
		out := append([]MarketplaceItem{}, cache.items...)
		s.mu.Unlock()
		return out, nil
	}
	s.mu.Unlock()

	items, etag, modified, err := s.fetchMarketplaceCatalog(ctx, cache.etag, cache.modified)
	if err != nil {
		if len(cache.items) > 0 {
			return append([]MarketplaceItem{}, cache.items...), nil
		}
		return nil, err
	}
	if items == nil {
		items = cache.items
	}
	if len(items) > catalogMaxItems {
		items = items[:catalogMaxItems]
	}
	s.mu.Lock()
	s.catalogCache = catalogCacheEntry{items: append([]MarketplaceItem{}, items...), etag: etag, modified: modified, expiresAt: time.Now().Add(s.cacheLifetime())}
	s.mu.Unlock()
	return append([]MarketplaceItem{}, items...), nil
}

func (s *Store) fetchMarketplaceCatalog(ctx context.Context, etag, modified string) ([]MarketplaceItem, string, string, error) {
	if s.remoteIndexURL == "" {
		idx, err := s.readIndex(ctx)
		if err != nil {
			return nil, etag, modified, err
		}
		items, err := adaptIndexToMarketplace(idx)
		return items, etag, modified, err
	}
	u, err := url.Parse(s.remoteIndexURL)
	if err != nil {
		return nil, etag, modified, err
	}
	if err := validateRemoteHost(u.Hostname()); err != nil {
		return nil, etag, modified, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.remoteIndexURL, nil)
	if err != nil {
		return nil, etag, modified, err
	}
	if etag != "" {
		req.Header.Set("If-None-Match", etag)
	}
	if modified != "" {
		req.Header.Set("If-Modified-Since", modified)
	}
	resp, err := hardenedHTTPClient(s.httpClient).Do(req)
	if err != nil {
		return nil, etag, modified, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		return nil, resp.Header.Get("ETag"), resp.Header.Get("Last-Modified"), nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, etag, modified, fmt.Errorf("unexpected status %d from %s", resp.StatusCode, s.remoteIndexURL)
	}
	data, err := readBoundedBody(resp.Body, maxManifestSize)
	if err != nil {
		return nil, etag, modified, err
	}
	idx, err := packregistry.ParseIndex(data)
	if err != nil {
		return nil, etag, modified, err
	}
	items, err := adaptIndexToMarketplace(idx)
	if err != nil {
		return nil, etag, modified, err
	}
	newETag := resp.Header.Get("ETag")
	newModified := resp.Header.Get("Last-Modified")
	if newETag == "" {
		sum := sha256.Sum256(data)
		newETag = hex.EncodeToString(sum[:])
	}
	return items, newETag, newModified, nil
}

func (s *Store) readManifestAndSig(ctx context.Context, pkg resolver.ResolvedPackage) ([]byte, []byte, error) {
	if s.remoteIndexURL == "" {
		manifestBytes, err := os.ReadFile(filepath.Join(s.registryRoot, pkg.ManifestURL))
		if err != nil {
			return nil, nil, err
		}
		var sigBytes []byte
		if pkg.SignatureURL != "" {
			sigBytes, _ = os.ReadFile(filepath.Join(s.registryRoot, pkg.SignatureURL))
		}
		return manifestBytes, sigBytes, nil
	}
	manifestBytes, err := s.fetchURLWithRetries(ctx, pkg.ManifestURL, maxManifestSize)
	if err != nil {
		return nil, nil, err
	}
	var sigBytes []byte
	if pkg.SignatureURL != "" {
		sigBytes, _ = s.fetchURLWithRetries(ctx, pkg.SignatureURL, maxSignatureSize)
	}
	return manifestBytes, sigBytes, nil
}

func (s *Store) signatureSummary(manifestBytes, sigBytes []byte, expectedKey string) SignatureSummary {
	if len(sigBytes) == 0 {
		if config.AllowUnsigned() {
			return SignatureSummary{Signed: false, Verified: false, Status: "unsigned (dev mode allowed)"}
		}
		return SignatureSummary{Signed: false, Verified: false, Status: "unsigned"}
	}
	sig, err := signing.ParseSignature(sigBytes)
	if err != nil {
		return SignatureSummary{Signed: true, Verified: false, SignatureKey: expectedKey, Status: "invalid signature file"}
	}
	if expectedKey != "" && sig.KeyID != expectedKey {
		return SignatureSummary{Signed: true, Verified: false, SignatureKey: sig.KeyID, Status: "signature key mismatch"}
	}
	ok, _, err := signing.VerifyManifestSignature(manifestBytes, sig, s.trustedKeys)
	if err != nil {
		return SignatureSummary{Signed: true, Verified: false, SignatureKey: sig.KeyID, Status: "verification error"}
	}
	if ok {
		return SignatureSummary{Signed: true, Verified: true, SignatureKey: sig.KeyID, Status: "verified"}
	}
	return SignatureSummary{Signed: true, Verified: false, SignatureKey: sig.KeyID, Status: "untrusted signature"}
}

func adaptIndexToMarketplace(idx packregistry.Index) ([]MarketplaceItem, error) {
	out := make([]MarketplaceItem, 0, len(idx.Packages))
	for _, p := range idx.Packages {
		if len(p.Versions) == 0 {
			continue
		}
		versions := make([]MarketplaceVersion, 0, len(p.Versions))
		for _, v := range p.Versions {
			versions = append(versions, MarketplaceVersion{Version: v.Version, SHA256: v.SHA256, Signed: v.SignatureURL != "", SignatureKeyID: v.SignatureKeyID, PublishedAt: ""})
		}
		sort.Slice(versions, func(i, j int) bool { return versions[i].Version > versions[j].Version })
		latest := versions[0]
		kind := "connector"
		if strings.HasPrefix(p.ID, "template.") {
			kind = "template"
		} else if strings.HasPrefix(p.ID, "policy.") {
			kind = "policy"
		}
		publisher := publisherFromID(p.ID, latest.SignatureKeyID)
		out = append(out, MarketplaceItem{
			Kind:          kind,
			ID:            p.ID,
			Name:          displayNameFromID(p.ID),
			Description:   fmt.Sprintf("%s package", kind),
			Publisher:     publisher,
			Versions:      versions,
			LatestVersion: latest.Version,
			RiskLevel:     tierOrRiskFromVersions(p.Versions, true),
			TierRequired:  tierOrRiskFromVersions(p.Versions, false),
			Tags:          []string{kind},
			Categories:    []string{kind},
		})
	}
	return out, nil
}

func displayNameFromID(id string) string {
	parts := strings.Split(id, ".")
	if len(parts) == 0 {
		return id
	}
	name := parts[len(parts)-1]
	return strings.ToUpper(name[:1]) + name[1:]
}

func publisherFromID(id, keyID string) Publisher {
	parts := strings.Split(id, ".")
	name := "Reach"
	if len(parts) > 1 {
		name = strings.ToUpper(parts[1][:1]) + parts[1][1:]
	}
	return Publisher{Name: name, KeyID: keyID, Verified: keyID != ""}
}

func tierOrRiskFromVersions(versions []packregistry.PackageVersion, risk bool) string {
	if len(versions) == 0 {
		if risk {
			return "medium"
		}
		return "none"
	}
	latest := versions[len(versions)-1]
	if risk {
		if latest.RiskLevel == "" {
			return "medium"
		}
		return latest.RiskLevel
	}
	if latest.TierRequired == "" {
		return "none"
	}
	return latest.TierRequired
}

func matchesFilter(item MarketplaceItem, filter CatalogFilter) bool {
	if filter.Kind != "" && item.Kind != filter.Kind {
		return false
	}
	if filter.Risk != "" && item.RiskLevel != filter.Risk {
		return false
	}
	if filter.Tier != "" && item.TierRequired != filter.Tier {
		return false
	}
	if filter.Capability != "" && !slices.Contains(item.RequiredCapabilities, filter.Capability) {
		return false
	}
	if filter.Tag != "" && !slices.Contains(item.Tags, filter.Tag) {
		return false
	}
	if filter.Publisher != "" && !strings.EqualFold(item.Publisher.Name, filter.Publisher) {
		return false
	}
	if filter.Verified && !item.Publisher.Verified {
		return false
	}
	if filter.Query != "" {
		q := strings.ToLower(filter.Query)
		if !strings.Contains(strings.ToLower(item.Name), q) && !strings.Contains(strings.ToLower(item.Description), q) && !strings.Contains(strings.ToLower(item.ID), q) {
			return false
		}
	}
	return true
}

func sortMarketplace(items []MarketplaceItem, sortMode string) {
	switch sortMode {
	case "name_desc":
		sort.Slice(items, func(i, j int) bool { return items[i].Name > items[j].Name })
	case "risk_desc":
		sort.Slice(items, func(i, j int) bool { return riskRank(items[i].RiskLevel) > riskRank(items[j].RiskLevel) })
	default:
		sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	}
}

func riskRank(level string) int {
	switch level {
	case "high":
		return 3
	case "medium":
		return 2
	default:
		return 1
	}
}

func tierAllowed(current, required string) bool {
	if required == "" || required == "none" {
		return true
	}
	rank := map[string]int{"free": 1, "pro": 2, "enterprise": 3}
	return rank[strings.ToLower(current)] >= rank[strings.ToLower(required)]
}

func missingCapabilities(required, accepted []string) []string {
	acc := map[string]struct{}{}
	for _, c := range accepted {
		acc[c] = struct{}{}
	}
	missing := make([]string, 0)
	for _, c := range required {
		if _, ok := acc[c]; !ok {
			missing = append(missing, c)
		}
	}
	return missing
}

func readBoundedBody(body io.Reader, maxBytes int64) ([]byte, error) {
	lr := io.LimitReader(body, maxBytes+1)
	data, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, errors.New("payload exceeds max size")
	}
	return data, nil
}

func CatalogFilterFromQuery(values url.Values) CatalogFilter {
	page, _ := strconv.Atoi(values.Get("page"))
	pageSize, _ := strconv.Atoi(values.Get("page_size"))
	verified := values.Get("verified") == "true"
	return CatalogFilter{
		Query:      values.Get("q"),
		Kind:       values.Get("kind"),
		Risk:       values.Get("risk"),
		Tier:       values.Get("tier"),
		Capability: values.Get("capability"),
		Tag:        values.Get("tag"),
		Publisher:  values.Get("publisher"),
		Sort:       values.Get("sort"),
		Page:       page,
		PageSize:   pageSize,
		Verified:   verified,
	}
}

func (s *Store) SetCurrentTier(tier string) {
	if tier == "" {
		tier = "free"
	}
	s.mu.Lock()
	s.currentTier = strings.ToLower(tier)
	s.mu.Unlock()
}

func (s *Store) SetCatalogTTL(ttl time.Duration) {
	s.mu.Lock()
	s.catalogTTL = ttl
	s.mu.Unlock()
}

func (s *Store) cacheLifetime() time.Duration {
	if s.catalogTTL > 0 {
		return s.catalogTTL
	}
	return catalogTTL
}

func (s *Store) CacheStats() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return map[string]any{
		"etag":       s.catalogCache.etag,
		"expires_at": s.catalogCache.expiresAt.UTC().Format(time.RFC3339),
		"items":      len(s.catalogCache.items),
		"ttl_secs":   int(s.cacheLifetime().Seconds()),
	}
}

func (s *Store) MarshalCatalogSample(limit int) ([]byte, error) {
	items, err := s.marketplaceCatalog(context.Background())
	if err != nil {
		return nil, err
	}
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return json.MarshalIndent(items, "", "  ")
}

func generateIdempotencyKey() string {
	b := make([]byte, 16)
	_, _ = io.ReadFull(rand.Reader, b)
	return hex.EncodeToString(b)
}
