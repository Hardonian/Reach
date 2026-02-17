package workspace

import (
	"context"
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type JobType string

const (
	CheckoutRepo    JobType = "CheckoutRepo"
	ApplyPatch      JobType = "ApplyPatch"
	RunCommand      JobType = "RunCommand"
	OpenPullRequest JobType = "OpenPullRequest"
)

type Gate interface{ Allow(action string) bool }

type Job struct {
	Type                                           JobType
	RepoURL, Branch, Patch, Command, Args, WorkDir string
}

type Runner struct {
	Root            string
	AllowedCommands map[string]struct{}
	Timeout         time.Duration
	MaxOutput       int
	Gate            Gate
}

func (r *Runner) Exec(ctx context.Context, j Job) ([]byte, error) {
	if r.Timeout == 0 {
		r.Timeout = 5 * time.Minute
	}
	ctx, cancel := context.WithTimeout(ctx, r.Timeout)
	defer cancel()
	switch j.Type {
	case CheckoutRepo:
		return r.run(ctx, r.Root, "git", []string{"clone", "--depth", "1", j.RepoURL, j.WorkDir})
	case ApplyPatch:
		return r.run(ctx, filepath.Join(r.Root, j.WorkDir), "git", []string{"apply", "-"}, j.Patch)
	case RunCommand:
		if _, ok := r.AllowedCommands[j.Command]; !ok {
			return nil, errors.New("command not allowed")
		}
		return r.run(ctx, filepath.Join(r.Root, j.WorkDir), j.Command, strings.Fields(j.Args))
	case OpenPullRequest:
		if r.Gate != nil && !r.Gate.Allow("github:open_pr") {
			return nil, errors.New("approval required")
		}
		return []byte("pr-open-requested"), nil
	default:
		return nil, errors.New("unknown job type")
	}
}

func (r *Runner) run(ctx context.Context, dir, cmdName string, args []string, stdin ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, cmdName, args...)
	cmd.Dir = dir
	if len(stdin) > 0 {
		cmd.Stdin = strings.NewReader(stdin[0])
	}
	out, err := cmd.CombinedOutput()
	if r.MaxOutput > 0 && len(out) > r.MaxOutput {
		out = out[:r.MaxOutput]
	}
	return out, err
}
