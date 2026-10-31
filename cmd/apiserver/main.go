package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"

	"github.com/AnarCom/p-graph/internal/api"
	pipelineHandler "github.com/AnarCom/p-graph/internal/api/handler/pipeline"
	"github.com/AnarCom/p-graph/internal/migrator"
	pipelineSvc "github.com/AnarCom/p-graph/internal/service/pipeline"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
	"github.com/AnarCom/p-graph/migrations"
)

func connectDB() (*sql.DB, error) {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return db, nil
}

func migrateDB(db *sql.DB) error {
	m, err := migrator.NewMigrator(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}

	if err := m.ApplyMigrations(db); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}

	return nil
}

func main() {
	db, err := connectDB()
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		err := db.Close()
		if err != nil {
			log.Fatal(err)
		}
	}()

	if err := migrateDB(db); err != nil {
		log.Fatal(err)
	}

	store := pipelineStorage.NewPostgresStorage(db)
	pipelines := pipelineSvc.NewService(store)

	handler := api.NewMux(pipelineHandler.NewPipelineHandler(pipelines))

	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	srv := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	log.Printf("apiserver listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
