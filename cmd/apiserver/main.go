package main

import (
	"context"
	"log"
	"net/http"

	pipelineHandler "github.com/AnarCom/p-graph/internal/api/handler/pipeline"
	"github.com/AnarCom/p-graph/internal/api/docs"
	"github.com/AnarCom/p-graph/internal/config"
	"github.com/AnarCom/p-graph/internal/migrator"
	pipelineSvc "github.com/AnarCom/p-graph/internal/service/pipeline"
	"github.com/AnarCom/p-graph/internal/storage"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
	"github.com/gorilla/mux"
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

	store := pipelineStorage.NewPostgresStorage(pool)
	tx := storage.NewTransactor(pool)

	root := mux.NewRouter()
	docs.Register(root)
	root.PathPrefix("/").Handler(pipelineHandler.NewPipelineMux(pipelineHandler.NewPipelineHandler(
		pipelineSvc.NewPipelineService(store, tx),
	)))

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: root,
	}

	log.Printf("apiserver listening on %s", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
