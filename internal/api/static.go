package api

// This file is intentionally minimal.
// In production builds (via Dockerfile), the React build output is copied to
// internal/api/web/dist/ before `go build`, and the embed directive below
// is activated by renaming/replacing this file with static_prod.go.
//
// For development, the frontend is served separately by Vite dev server (port 5173)
// which proxies API calls to the Go backend (port 8080).
