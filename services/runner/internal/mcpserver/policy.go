package mcpserver

import "strings"

type StaticPolicy struct {
	allowed map[string]struct{}
}

func NewStaticPolicy(capabilities []string) *StaticPolicy {
	allowed := make(map[string]struct{}, len(capabilities))
	for _, capability := range capabilities {
		capability = strings.TrimSpace(capability)
		if capability == "" {
			continue
		}
		allowed[capability] = struct{}{}
	}
	return &StaticPolicy{allowed: allowed}
}

func (p *StaticPolicy) Allowed(_ string, capability string) bool {
	_, ok := p.allowed[capability]
	return ok
}
