package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/api/middleware"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewAuthHandler(db *sqlx.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string      `json:"token"`
	User  userPayload `json:"user"`
}

type userPayload struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req loginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "email and password are required")
	}

	var user struct {
		ID       int64  `db:"id"`
		Name     string `db:"name"`
		Email    string `db:"email"`
		Password string `db:"password"`
		Role     string `db:"role"`
	}
	err := h.db.GetContext(c.Request().Context(), &user,
		`SELECT id, name, email, password, role FROM users WHERE email = $1`, req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid email or password")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "database error")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid email or password")
	}

	token, err := middleware.GenerateToken(h.cfg.JWTSecret, user.ID, user.Email, user.Role)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}

	return c.JSON(http.StatusOK, authResponse{
		Token: token,
		User: userPayload{
			ID:    user.ID,
			Name:  user.Name,
			Email: user.Email,
			Role:  user.Role,
		},
	})
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req registerRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Name == "" || req.Email == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name, email, and password are required")
	}
	if len(req.Password) < 8 {
		return echo.NewHTTPError(http.StatusBadRequest, "password must be at least 8 characters")
	}

	// Check if user already exists
	var exists bool
	_ = h.db.GetContext(c.Request().Context(), &exists,
		`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, req.Email)
	if exists {
		return echo.NewHTTPError(http.StatusConflict, "email already registered")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
	}

	var userID int64
	err = h.db.QueryRowContext(c.Request().Context(),
		`INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id`,
		req.Name, req.Email, string(hashed), "admin",
	).Scan(&userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create user")
	}

	token, err := middleware.GenerateToken(h.cfg.JWTSecret, userID, req.Email, "admin")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}

	return c.JSON(http.StatusCreated, authResponse{
		Token: token,
		User: userPayload{
			ID:    userID,
			Name:  req.Name,
			Email: req.Email,
			Role:  "admin",
		},
	})
}
