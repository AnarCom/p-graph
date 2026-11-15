package main

import (
	"context"
	"log"
	"net/http"

	"github.com/AnarCom/p-graph/internal/api/docs"
	gen "github.com/AnarCom/p-graph/internal/api/gen/apiserver"
	artifactHandler "github.com/AnarCom/p-graph/internal/api/handler/artifact"
	pipelineHandler "github.com/AnarCom/p-graph/internal/api/handler/pipeline"
	"github.com/AnarCom/p-graph/internal/config"
	"github.com/AnarCom/p-graph/internal/migrator"
	artifactSvc "github.com/AnarCom/p-graph/internal/service/artifact"
	pipelineSvc "github.com/AnarCom/p-graph/internal/service/pipeline"
	"github.com/AnarCom/p-graph/internal/storage"
	artifactStorage "github.com/AnarCom/p-graph/internal/storage/artifact"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
	s3Storage "github.com/AnarCom/p-graph/internal/storage/s3"
	"github.com/gorilla/mux"
)

type serverHandler struct {
	*pipelineHandler.PipelineHandler
	*artifactHandler.ArtifactHandler
}

var _ gen.StrictServerInterface = (*serverHandler)(nil)

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

	objects, err := s3Storage.NewObjectStorage(
		cfg.S3.Endpoint,
		cfg.S3.AccessKey,
		cfg.S3.SecretKey,
		cfg.S3.Bucket,
		cfg.S3.UseSSL,
	)
	if err != nil {
		log.Fatal(err)
	}
	if err = objects.EnsureBucket(ctx); err != nil {
		log.Fatal(err)
	}

	tx := storage.NewTransactor(pool)
	pipelines := pipelineStorage.NewPostgresStorage(pool)
	artifacts := artifactStorage.NewPostgresStorage(pool)

	server := &serverHandler{
		PipelineHandler: pipelineHandler.NewPipelineHandler(
			pipelineSvc.NewPipelineService(pipelines, tx),
		),
		ArtifactHandler: artifactHandler.NewArtifactHandler(
			artifactSvc.NewArtifactService(artifacts, tx, objects),
		),
	}

	root := mux.NewRouter()
	docs.Register(root)
	root.PathPrefix("/").Handler(pipelineHandler.NewPipelineMux(server))

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: root,
	}

	log.Printf("apiserver listening on %s", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
