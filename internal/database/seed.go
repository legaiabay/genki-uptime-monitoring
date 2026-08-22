package database

import (
	"context"
	"log"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

// Seed creates a default admin user if no users exist in the database.
func Seed(db *sqlx.DB) error {
	ctx := context.Background()

	var count int
	err := db.GetContext(ctx, &count, `SELECT COUNT(*) FROM users`)
	if err != nil {
		return err
	}

	if count > 0 {
		return nil // users already exist, skip seeding
	}

	// Default admin credentials
	email := "admin@genki.local"
	password := "admin123"
	name := "Admin"

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx,
		`INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)`,
		name, email, string(hashed), "admin")
	if err != nil {
		return err
	}

	log.Printf("[seed] default admin created — email: %s / password: %s", email, password)
	return nil
}
