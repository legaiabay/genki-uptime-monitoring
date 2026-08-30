package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     string
	Environment   string
	ResetSecret   string
	// DBEncryptionKey is a 32-byte hex-encoded key used to AES-256-GCM encrypt
	// database monitor connection strings at rest. Generate with:
	//   openssl rand -hex 32
	// If left empty, connection strings are stored in plaintext (not recommended).
	DBEncryptionKey string
}

func Load() (*Config, error) {
	// Load .env file only in development
	_ = godotenv.Load()

	cfg := &Config{
		Port:            getEnv("PORT", ":8080"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		JWTSecret:       getEnv("JWT_SECRET", ""),
		Environment:     getEnv("APP_ENV", "development"),
		ResetSecret:     getEnv("RESET_SECRET", ""),
		DBEncryptionKey: getEnv("DB_ENCRYPTION_KEY", ""),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
