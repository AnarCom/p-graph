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

	argoClient := argo.NewArgoClient(cfg.ArgoServerURL, cfg.ArgoNamespace)

	handler := schedulerHandler.NewSchedulerMux(schedulerHandler.NewSchedulerHandler(runSvc.NewRunService(argoClient)))

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: handler,
	}

	log.Printf("scheduler listening on %s", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
