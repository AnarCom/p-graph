package middleware

import (
	"net/http"

	"github.com/gorilla/handlers"
)

func CORS(h http.Handler) http.Handler {
	return handlers.CORS(
		handlers.AllowedOrigins([]string{
			"http://localhost:5173",
		}),
		handlers.AllowedMethods([]string{
			http.MethodGet,
			http.MethodPut,
			http.MethodPost,
			http.MethodDelete,
		}),
		handlers.AllowedHeaders([]string{"Content-Type"}),
	)(h)
}
