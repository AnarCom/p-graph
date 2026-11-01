package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/AnarCom/p-graph/internal/api"
	pipelineHandler "github.com/AnarCom/p-graph/internal/api/handler/pipeline"
	"github.com/AnarCom/p-graph/internal/config"
	"github.com/AnarCom/p-graph/internal/migrator"
	pipelineSvc "github.com/AnarCom/p-graph/internal/service/pipeline"
	"github.com/AnarCom/p-graph/internal/storage"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
	"github.com/AnarCom/p-graph/migrations"
)

func connectDB(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}

func migrateDB(pool *pgxpool.Pool) error {
	m, err := migrator.NewMigrator(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}

	if err := m.ApplyMigrations(stdlib.OpenDBFromPool(pool)); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}

	return nil
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	pool, err := connectDB(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	if err := migrateDB(pool); err != nil {
		log.Fatal(err)
	}

	store := pipelineStorage.NewPostgresStorage(pool)
	tx := storage.NewTransactor(pool)
	pipelines := pipelineSvc.NewService(store, tx)

	handler := api.NewMux(pipelineHandler.NewPipelineHandler(pipelines))

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: handler,
	}

	log.Printf("apiserver listening on %s", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
