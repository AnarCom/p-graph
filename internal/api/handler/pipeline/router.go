package pipelineHandler

import (
	"net/http"

	handler "github.com/AnarCom/p-graph/internal/api"
	gen "github.com/AnarCom/p-graph/internal/api/gen/apiserver"
	"github.com/AnarCom/p-graph/internal/middleware"
	"github.com/gorilla/mux"
)

func NewPipelineMux(h gen.StrictServerInterface) http.Handler {
	router := mux.NewRouter()
	router.Use(handler.PathVarsToPathValue)

	return middleware.Apply(
		gen.HandlerFromMux(gen.NewStrictHandler(h, nil), handler.NewGorillaServeRouter(router)),
		middleware.CORS,
	)
}
