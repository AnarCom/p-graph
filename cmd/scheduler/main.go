package main

import (
	"log"
	"net/http"

	schedulerHandler "github.com/AnarCom/p-graph/internal/api/handler/scheduler"
	"github.com/AnarCom/p-graph/internal/config"
	runSvc "github.com/AnarCom/p-graph/internal/service/run"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	handler := schedulerHandler.NewSchedulerMux(schedulerHandler.NewSchedulerHandler(runSvc.NewService()))

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: handler,
	}

	log.Printf("scheduler listening on %s", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
