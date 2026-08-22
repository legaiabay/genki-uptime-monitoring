package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strconv"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/api/middleware"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/models"
)

type APIKeyHandler struct {
	db *sqlx.DB
}

func NewAPIKeyHandler(db *sqlx.DB) *APIKeyHandler {
	return &APIKeyHandler{db: db}
}

// generateSecureKey produces a 32-byte (64 hex-char) cryptographically random key
// prefixed with "gk_" so users can identify it easily.
func generateSecureKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "gk_" + hex.EncodeToString(b), nil
}

// List returns all API keys for the authenticated user.
// The actual key value is masked in list responses — only the prefix is shown.
func (h *APIKeyHandler) List(c echo.Context) error {
	userID := middleware.GetUserID(c)

	var keys []models.APIKey
	err := h.db.SelectContext(c.Request().Context(), &keys,
		`SELECT id, user_id, name, key, last_used, expires_at, created_at
		 FROM api_keys
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch api keys")
	}
	if keys == nil {
		keys = []models.APIKey{}
	}

	// Mask key values — return only first 10 chars + "..."
	type apiKeyResponse struct {
		ID        int64   `json:"id"`
		UserID    int64   `json:"user_id"`
		Name      string  `json:"name"`
		KeyPrefix string  `json:"key_prefix"`
		LastUsed  *string `json:"last_used"`
		ExpiresAt *string `json:"expires_at"`
		CreatedAt string  `json:"created_at"`
	}

	resp := make([]apiKeyResponse, len(keys))
	for i, k := range keys {
		prefix := k.Key
		if len(prefix) > 10 {
			prefix = prefix[:10] + "…"
		}

		var lastUsed *string
		if k.LastUsed != nil {
			s := k.LastUsed.Format("2006-01-02T15:04:05Z07:00")
			lastUsed = &s
		}
		var expiresAt *string
		if k.ExpiresAt != nil {
			s := k.ExpiresAt.Format("2006-01-02T15:04:05Z07:00")
			expiresAt = &s
		}

		resp[i] = apiKeyResponse{
			ID:        k.ID,
			UserID:    k.UserID,
			Name:      k.Name,
			KeyPrefix: prefix,
			LastUsed:  lastUsed,
			ExpiresAt: expiresAt,
			CreatedAt: k.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	return c.JSON(http.StatusOK, echo.Map{"data": resp})
}

// Create generates and stores a new API key for the authenticated user.
// The full key is returned ONCE in the creation response and never again.
func (h *APIKeyHandler) Create(c echo.Context) error {
	userID := middleware.GetUserID(c)

	var req struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	rawKey, err := generateSecureKey()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate key")
	}

	var key models.APIKey
	err = h.db.QueryRowxContext(c.Request().Context(),
		`INSERT INTO api_keys (user_id, name, key)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, name, key, last_used, expires_at, created_at`,
		userID, req.Name, rawKey,
	).StructScan(&key)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create api key: "+err.Error())
	}

	// Return the full key in the creation response only
	return c.JSON(http.StatusCreated, echo.Map{"data": key})
}

// Delete revokes (deletes) an API key by ID. Only the owner can delete their own keys.
func (h *APIKeyHandler) Delete(c echo.Context) error {
	userID := middleware.GetUserID(c)

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	result, err := h.db.ExecContext(c.Request().Context(),
		`DELETE FROM api_keys WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete api key")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "api key not found")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "api key revoked"})
}

// UpdateLastUsed is called by the auth middleware when a key is successfully used.
func UpdateAPIKeyLastUsed(db *sqlx.DB, keyValue string) {
	_, _ = db.Exec(
		`UPDATE api_keys SET last_used = NOW() WHERE key = $1`,
		keyValue,
	)
}

// LookupAPIKey validates a raw key string and returns the associated user row.
func LookupAPIKey(db *sqlx.DB, rawKey string) (*models.User, error) {
	var key models.APIKey
	err := db.QueryRowx(
		`SELECT id, user_id, name, key, last_used, expires_at, created_at
		 FROM api_keys
		 WHERE key = $1
		   AND (expires_at IS NULL OR expires_at > NOW())`,
		rawKey,
	).StructScan(&key)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var user models.User
	err = db.QueryRowx(
		`SELECT id, name, email, password, role, created_at, updated_at
		 FROM users WHERE id = $1`,
		key.UserID,
	).StructScan(&user)
	if err != nil {
		return nil, err
	}

	return &user, nil
}
