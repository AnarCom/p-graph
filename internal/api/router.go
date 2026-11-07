package handler

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

type GorillaServeRouter struct {
	router *mux.Router
}

func NewGorillaServeRouter(router *mux.Router) *GorillaServeRouter {
	return &GorillaServeRouter{router: router}
}

func (g *GorillaServeRouter) HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request)) {
	method, path, _ := strings.Cut(pattern, " ")
	g.router.HandleFunc(path, handler).Methods(method)
}

func (g *GorillaServeRouter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	g.router.ServeHTTP(w, r)
}

func PathVarsToPathValue(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for name, value := range mux.Vars(r) {
			r.SetPathValue(name, value)
		}
		next.ServeHTTP(w, r)
	})
}
