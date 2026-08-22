package api

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/labstack/echo/v4"
)

//go:embed web/dist
var embeddedFiles embed.FS

// spaFileSystem wraps an fs.FS and falls back to index.html for unknown paths,
// enabling client-side routing in the embedded React SPA.
type spaFileSystem struct {
	root fs.FS
}

func (s spaFileSystem) Open(name string) (fs.File, error) {
	f, err := s.root.Open(name)
	if err != nil {
		// Fall back to index.html for SPA routes
		return s.root.Open("index.html")
	}
	return f, nil
}

func (s *Server) serveStaticFiles() {
	distFS, err := fs.Sub(embeddedFiles, "web/dist")
	if err != nil {
		panic("failed to create sub filesystem for embedded frontend: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(spaFileSystem{root: distFS}))
	s.echo.GET("/*", echo.WrapHandler(http.StripPrefix("/", fileServer)))
}
