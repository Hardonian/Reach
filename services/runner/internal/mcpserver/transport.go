package mcpserver

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

type rpcRequest struct {
	JSONRPC string         `json:"jsonrpc"`
	ID      any            `json:"id,omitempty"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string     `json:"jsonrpc"`
	ID      any        `json:"id,omitempty"`
	Result  any        `json:"result,omitempty"`
	Error   *rpcErrObj `json:"error,omitempty"`
}

type rpcErrObj struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func ServeStdio(ctx context.Context, srv *Server, in io.Reader, out io.Writer) error {
	scanner := bufio.NewScanner(in)
	enc := json.NewEncoder(out)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return nil
		default:
		}
		var req rpcRequest
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			_ = enc.Encode(rpcResponse{JSONRPC: "2.0", Error: &rpcErrObj{Code: -32700, Message: "parse error"}})
			continue
		}
		resp := handleRPC(ctx, srv, req)
		if err := enc.Encode(resp); err != nil {
			return err
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return nil
}

func HTTPHandler(srv *Server) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req rpcRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeRPC(w, rpcResponse{JSONRPC: "2.0", Error: &rpcErrObj{Code: -32700, Message: "parse error"}})
			return
		}
		writeRPC(w, handleRPC(r.Context(), srv, req))
	})
}

func writeRPC(w http.ResponseWriter, response rpcResponse) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func handleRPC(ctx context.Context, srv *Server, req rpcRequest) rpcResponse {
	resp := rpcResponse{JSONRPC: "2.0", ID: req.ID}
	switch req.Method {
	case "initialize":
		resp.Result = map[string]any{"server": "reach-runner", "tools": len(srv.MCP().ListTools())}
	case "tools/list":
		resp.Result = map[string]any{"tools": srv.MCP().ListTools()}
	case "tools/call":
		name, _ := req.Params["name"].(string)
		args, _ := req.Params["arguments"].(map[string]any)
		runID, _ := req.Params["run_id"].(string)
		if name == "" {
			resp.Error = &rpcErrObj{Code: -32602, Message: "tool name is required"}
			return resp
		}
		result, err := srv.CallTool(ctx, runID, name, args)
		if err != nil {
			resp.Error = toolErrToRPC(err)
			return resp
		}
		resp.Result = result
	default:
		resp.Error = &rpcErrObj{Code: -32601, Message: fmt.Sprintf("method not found: %s", req.Method)}
	}
	return resp
}

func toolErrToRPC(err error) *rpcErrObj {
	switch {
	case errors.Is(err, ErrCapabilityDenied):
		return &rpcErrObj{Code: -32010, Message: err.Error()}
	default:
		return &rpcErrObj{Code: -32000, Message: err.Error()}
	}
}
