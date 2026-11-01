FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY . .
ARG SERVICE
RUN CGO_ENABLED=0 go build -o bin/service ./cmd/${SERVICE}

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/bin/service /app/service
CMD ["/app/service"]
