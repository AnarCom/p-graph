package schedulerHandler

import (
	"net/http"

	handler "github.com/AnarCom/p-graph/internal/api"
	gen "github.com/AnarCom/p-graph/internal/api/gen/scheduler"
	"github.com/AnarCom/p-graph/internal/middleware"
	"github.com/gorilla/mux"
)

func NewSchedulerMux(h gen.StrictServerInterface) http.Handler {
	router := mux.NewRouter()
	router.Use(handler.PathVarsToPathValue)

	return middleware.Apply(
		gen.HandlerFromMux(gen.NewStrictHandler(h, nil), handler.NewGorillaServeRouter(router)),
		middleware.CORS,
	)
}
