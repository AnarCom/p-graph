package api

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	genapi "github.com/AnarCom/p-graph/internal/api/gen"
)

func NewMux(h genapi.StrictServerInterface) http.Handler {
	router := mux.NewRouter()
	router.Use(pathVarsToPathValue)
	return genapi.HandlerFromMux(genapi.NewStrictHandler(h, nil), &gorillaServeMux{router: router})
}

type gorillaServeMux struct {
	router *mux.Router
}

func (g *gorillaServeMux) HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request)) {
	method, path, _ := strings.Cut(pattern, " ")
	g.router.HandleFunc(path, handler).Methods(method)
}

func (g *gorillaServeMux) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	g.router.ServeHTTP(w, r)
}

func pathVarsToPathValue(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for name, value := range mux.Vars(r) {
			r.SetPathValue(name, value)
		}
		next.ServeHTTP(w, r)
	})
}
