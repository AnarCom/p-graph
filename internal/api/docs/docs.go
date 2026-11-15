package docs

import (
	_ "embed"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/AnarCom/p-graph/api"
)

//go:embed swagger.html
var swaggerHTML []byte

func Register(router *mux.Router) {
	router.HandleFunc("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/yaml")
		w.Write(api.OpenAPISpec)
	})
	router.HandleFunc("/docs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(swaggerHTML)
	})
}
