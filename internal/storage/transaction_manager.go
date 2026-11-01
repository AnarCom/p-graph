package storage

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ErrTransaction struct {
	Err error
}

func (e ErrTransaction) Error() string {
	return fmt.Sprintf("transaction error: %v", e.Err)
}

func NewTransactionError(err error) ErrTransaction {
	return ErrTransaction{Err: err}
}

type PostgresTransactor struct {
	pool *pgxpool.Pool
}

func NewTransactor(pool *pgxpool.Pool) *PostgresTransactor {
	return &PostgresTransactor{pool: pool}
}

func (t *PostgresTransactor) Do(ctx context.Context, fn func(ctx context.Context) error) error {
	if _, err := ExecutorFrom(ctx); err == nil {
		return fn(ctx)
	}

	conn, err := t.pool.Acquire(ctx)
	if err != nil {
		return NewTransactionError(err)
	}
	defer conn.Release()

	tx, err := conn.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return NewTransactionError(err)
	}

	if err := fn(WithExecutor(ctx, tx)); err != nil {
		if rbErr := tx.Rollback(context.WithoutCancel(ctx)); rbErr != nil {
			return errors.Join(err, NewTransactionError(rbErr))
		}
		return err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return NewTransactionError(err)
	}

	return nil
}
