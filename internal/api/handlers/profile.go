package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/legaiabay/genki-uptime-monitoring/internal/api/middleware"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type ProfileHandler struct {
	db *sqlx.DB
}

func NewProfileHandler(db *sqlx.DB) *ProfileHandler {
	return &ProfileHandler{db: db}
}

type profileResponse struct {
	ID        int64     `db:"id"         json:"id"`
	Name      string    `db:"name"       json:"name"`
	Email     string    `db:"email"      json:"email"`
	Role      string    `db:"role"       json:"role"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// GetProfile returns the current logged-in user's profile.
func (h *ProfileHandler) GetProfile(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}

	var profile profileResponse
	err := h.db.QueryRowxContext(c.Request().Context(),
		`SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1`, userID,
	).StructScan(&profile)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "user not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch profile")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": profile})
}

type updateProfileRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// UpdateProfile updates name and/or email.
func (h *ProfileHandler) UpdateProfile(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}

	var req updateProfileRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Name == "" && req.Email == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name or email is required")
	}

	// Check email uniqueness if email is being changed
	if req.Email != "" {
		var existingID int64
		_ = h.db.QueryRowContext(c.Request().Context(),
			`SELECT id FROM users WHERE email = $1 AND id != $2`, req.Email, userID,
		).Scan(&existingID)
		if existingID > 0 {
			return echo.NewHTTPError(http.StatusConflict, "email already in use")
		}
	}

	var profile profileResponse
	err := h.db.QueryRowxContext(c.Request().Context(),
		`UPDATE users
		 SET name      = CASE WHEN $1 = '' THEN name  ELSE $1 END,
		     email     = CASE WHEN $2 = '' THEN email ELSE $2 END,
		     updated_at = NOW()
		 WHERE id = $3
		 RETURNING id, name, email, role, created_at, updated_at`,
		req.Name, req.Email, userID,
	).StructScan(&profile)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "user not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update profile")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": profile})
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
	ConfirmPassword string `json:"confirm_password"`
}

// ChangePassword validates current password and sets a new one.
func (h *ProfileHandler) ChangePassword(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}

	var req changePasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "current and new password are required")
	}
	if len(req.NewPassword) < 8 {
		return echo.NewHTTPError(http.StatusBadRequest, "new password must be at least 8 characters")
	}
	if req.NewPassword != req.ConfirmPassword {
		return echo.NewHTTPError(http.StatusBadRequest, "passwords do not match")
	}

	// Fetch current hash
	var currentHash string
	err := h.db.QueryRowContext(c.Request().Context(),
		`SELECT password FROM users WHERE id = $1`, userID,
	).Scan(&currentHash)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch user")
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "current password is incorrect")
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
	}

	_, err = h.db.ExecContext(c.Request().Context(),
		`UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
		string(newHash), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update password")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "password updated successfully"})
}
