package storage

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrConnNotFound = errors.New("connection not found")

type Conn interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type executorKey struct{}

func WithExecutor(ctx context.Context, conn Conn) context.Context {
	return context.WithValue(ctx, executorKey{}, conn)
}

func ExecutorFrom(ctx context.Context) (Conn, error) {
	if conn, ok := ctx.Value(executorKey{}).(Conn); ok {
		return conn, nil
	}
	return nil, ErrConnNotFound
}
