package migrator

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"

	"github.com/AnarCom/p-graph/migrations"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

type Migrator struct {
	srcDriver source.Driver
}

func NewMigrator(sqlFiles embed.FS, dirName string) (*Migrator, error) {
	d, err := iofs.New(sqlFiles, dirName)
	if err != nil {
		return nil, fmt.Errorf("open sql files: %w", err)
	}
	return &Migrator{
		srcDriver: d,
	}, nil
}

func (m *Migrator) Apply(db *sql.DB) (err error) {
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("create db instance: %w", err)
	}

	migrator, err := migrate.NewWithInstance("migration_embeded_sql_files", m.srcDriver, "psql_db", driver)
	if err != nil {
		return fmt.Errorf("create migration: %w", err)
	}

	defer func() {
		if drvErr := driver.Close(); drvErr != nil {
			err = errors.Join(err, fmt.Errorf("close db driver: %w", drvErr))
		}
	}()

	defer func() {
		if srcErr := m.srcDriver.Close(); srcErr != nil {
			err = errors.Join(err, fmt.Errorf("close migrations source: %w", srcErr))
		}
	}()

	if err = migrator.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}

	return nil
}

func Apply(pool *pgxpool.Pool) error {
	m, err := NewMigrator(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}

	if err := m.Apply(stdlib.OpenDBFromPool(pool)); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}

	return nil
}
