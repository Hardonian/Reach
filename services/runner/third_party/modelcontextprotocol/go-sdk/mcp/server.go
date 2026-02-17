package mcp

import (
	"context"
	"fmt"
	"sort"
)

type Tool struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type ToolHandler func(ctx context.Context, runID string, input map[string]any) (any, error)

type Server struct {
	name     string
	version  string
	tools    map[string]Tool
	handlers map[string]ToolHandler
}

type Option func(*Server)

func WithName(name string) Option {
	return func(s *Server) { s.name = name }
}

func WithVersion(version string) Option {
	return func(s *Server) { s.version = version }
}

func NewServer(opts ...Option) *Server {
	s := &Server{tools: map[string]Tool{}, handlers: map[string]ToolHandler{}}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *Server) AddTool(tool Tool, handler ToolHandler) {
	s.tools[tool.Name] = tool
	s.handlers[tool.Name] = handler
}

func (s *Server) ListTools() []Tool {
	out := make([]Tool, 0, len(s.tools))
	for _, tool := range s.tools {
		out = append(out, tool)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (s *Server) CallTool(ctx context.Context, name string, input map[string]any, runID string) (any, error) {
	h, ok := s.handlers[name]
	if !ok {
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
	return h(ctx, runID, input)
}
