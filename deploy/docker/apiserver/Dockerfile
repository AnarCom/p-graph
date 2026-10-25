FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o bin/apiserver ./cmd/apiserver

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/bin/apiserver /app/apiserver
CMD ["/app/apiserver"]
