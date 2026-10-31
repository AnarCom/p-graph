package middleware

import "net/http"

type Middleware func(http.Handler) http.Handler

func Apply(h http.Handler, middlewares ...Middleware) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}
