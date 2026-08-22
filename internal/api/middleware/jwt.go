package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type JWTClaims struct {
	UserID int64  `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateToken creates a signed JWT token for a user.
func GenerateToken(secret string, userID int64, email, role string) (string, error) {
	claims := &JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// JWT returns an Echo middleware that accepts either:
//   - A signed JWT Bearer token, or
//   - A "gk_…" API key (looked up in the api_keys table)
//
// On success it sets user_id, email, and role into the Echo context,
// exactly as the pure-JWT path did, so all downstream handlers are unaffected.
func JWT(secret string, db ...*sqlx.DB) echo.MiddlewareFunc {
	// db is variadic so existing call-sites (middleware.JWT(s.cfg.JWTSecret)) still compile.
	// Pass the DB to enable API-key fallback.
	var database *sqlx.DB
	if len(db) > 0 {
		database = db[0]
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization header format")
			}

			tokenStr := parts[1]

			// ── API-key path: tokens starting with "gk_" are not JWTs ────────
			if strings.HasPrefix(tokenStr, "gk_") {
				if database == nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "api key authentication not configured")
				}
				return handleAPIKey(c, next, database, tokenStr)
			}

			// ── JWT path ──────────────────────────────────────────────────────
			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}

			c.Set("user_id", claims.UserID)
			c.Set("email", claims.Email)
			c.Set("role", claims.Role)

			return next(c)
		}
	}
}

// handleAPIKey looks up the raw key in the database, sets context values,
// and fires UpdateAPIKeyLastUsed asynchronously so it doesn't slow the request.
func handleAPIKey(c echo.Context, next echo.HandlerFunc, db *sqlx.DB, rawKey string) error {
	type apiKeyRow struct {
		UserID int64  `db:"user_id"`
		Name   string `db:"name"`
		Email  string `db:"email"`
		Role   string `db:"role"`
	}

	var row apiKeyRow
	err := db.QueryRowxContext(c.Request().Context(),
		`SELECT ak.user_id, ak.name, u.email, u.role
		 FROM api_keys ak
		 JOIN users u ON u.id = ak.user_id
		 WHERE ak.key = $1
		   AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
		rawKey,
	).StructScan(&row)

	if err != nil {
		// sql.ErrNoRows or any other error → treat as invalid key
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired api key")
	}

	// Update last_used non-blocking
	go func() {
		_, _ = db.Exec(`UPDATE api_keys SET last_used = NOW() WHERE key = $1`, rawKey)
	}()

	c.Set("user_id", row.UserID)
	c.Set("email", row.Email)
	c.Set("role", row.Role)

	return next(c)
}

// GetUserID extracts the user ID from the Echo context.
func GetUserID(c echo.Context) int64 {
	v := c.Get("user_id")
	if v == nil {
		return 0
	}
	id, ok := v.(int64)
	if !ok {
		return 0
	}
	return id
}
