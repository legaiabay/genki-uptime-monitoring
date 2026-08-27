package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

// AppVersion is set at build time via -ldflags "-X ...handlers.AppVersion=vX.Y.Z"
// Falls back to "dev" when running without ldflags (local development).
var AppVersion = "dev"

// GitHubRepo is the owner/repo slug used to fetch the latest release.
const GitHubRepo = "legaiabay/genki-uptime-monitoring"

type VersionInfo struct {
	Current         string `json:"current"`
	Latest          string `json:"latest"`
	UpdateAvailable bool   `json:"update_available"`
	ReleaseURL      string `json:"release_url"`
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

type VersionHandler struct{}

func NewVersionHandler() *VersionHandler {
	return &VersionHandler{}
}

func (h *VersionHandler) GetVersion(c echo.Context) error {
	latest, releaseURL, err := fetchLatestRelease(c.Request().Context())
	if err != nil {
		// Return current version even if GitHub is unreachable.
		return c.JSON(http.StatusOK, VersionInfo{
			Current:         AppVersion,
			Latest:          "",
			UpdateAvailable: false,
			ReleaseURL:      "https://github.com/" + GitHubRepo + "/releases",
		})
	}

	updateAvailable := latest != "" && latest != AppVersion && AppVersion != "dev"

	return c.JSON(http.StatusOK, VersionInfo{
		Current:         AppVersion,
		Latest:          latest,
		UpdateAvailable: updateAvailable,
		ReleaseURL:      releaseURL,
	})
}

func fetchLatestRelease(ctx context.Context) (tag string, url string, err error) {
	reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet,
		"https://api.github.com/repos/"+GitHubRepo+"/releases/latest", nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "genki-uptime-monitoring/"+AppVersion)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", "", err
	}

	return release.TagName, release.HTMLURL, nil
}
