package main

import (
	"context"
	"log"
	"net/http"

	schedulerHandler "github.com/AnarCom/p-graph/internal/api/handler/scheduler"
	"github.com/AnarCom/p-graph/internal/client/argo"
	"github.com/AnarCom/p-graph/internal/config"
	"github.com/AnarCom/p-graph/internal/migrator"
	runSvc "github.com/AnarCom/p-graph/internal/service/run"
	"github.com/AnarCom/p-graph/internal/storage"
	artifactStorage "github.com/AnarCom/p-graph/internal/storage/artifact"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	pool, err := storage.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	if err := migrator.Apply(pool); err != nil {
		log.Fatal(err)
	}

	argoClient := argo.NewArgoClient(cfg.Argo.ServerURL, cfg.Argo.Namespace)

	pipelines := pipelineStorage.NewPostgresStorage(pool)
	artifacts := artifactStorage.NewPostgresStorage(pool)
	tx := storage.NewTransactor(pool)

	s3Source := runSvc.S3Source{
		Endpoint: cfg.S3.Endpoint,
		Bucket:   cfg.S3.Bucket,
		Insecure: !cfg.S3.UseSSL,
	}

	handler := schedulerHandler.NewSchedulerMux(schedulerHandler.NewSchedulerHandler(
		runSvc.NewRunService(pipelines, artifacts, tx, argoClient, s3Source),
	))

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: handler,
	}

	log.Printf("scheduler listening on %s", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
