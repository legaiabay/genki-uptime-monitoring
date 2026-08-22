package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/api"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/config"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/database"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/scheduler"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.Migrate(db.DB, cfg.DatabaseURL); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// Init scheduler
	sched := scheduler.New(db)
	sched.Start()
	defer sched.Stop()

	// Init and start HTTP server
	srv := api.NewServer(cfg, db)

	go func() {
		if err := srv.Start(cfg.Port); err != nil {
			log.Printf("server stopped: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server forced to shutdown: %v", err)
	}

	log.Println("server exited gracefully")
}
