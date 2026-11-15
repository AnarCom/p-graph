package artifactStorage

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/AnarCom/p-graph/internal/model"
	"github.com/AnarCom/p-graph/internal/storage"
)

type PostgresStorage struct {
	db storage.Conn
}

func NewPostgresStorage(db storage.Conn) *PostgresStorage {
	return &PostgresStorage{db: db}
}

func (s *PostgresStorage) Create(ctx context.Context, id uuid.UUID, a model.Artifact) (model.Artifact, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return model.Artifact{}, err
	}

	err = conn.QueryRow(ctx, `
		INSERT INTO artifacts (id, filename, content_type, size_bytes, s3_key)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at
	`, id, a.Filename, a.ContentType, a.Size, a.S3Key).Scan(&a.CreatedAt)
	if err != nil {
		log.Printf("artifact storage: create %s: %v", id, err)
		return model.Artifact{}, fmt.Errorf("create artifact: %w", storage.ErrStorage)
	}
	return a, nil
}

func (s *PostgresStorage) GetArtifact(ctx context.Context, id uuid.UUID) (model.Artifact, bool, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return model.Artifact{}, false, err
	}

	var a model.Artifact
	err = conn.QueryRow(ctx, `
		SELECT id, filename, content_type, size_bytes, s3_key, created_at
		FROM artifacts
		WHERE id = $1
	`, id).Scan(&a.ArtifactID, &a.Filename, &a.ContentType, &a.Size, &a.S3Key, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Artifact{}, false, nil
	}
	if err != nil {
		log.Printf("artifact storage: get %s: %v", id, err)
		return model.Artifact{}, false, fmt.Errorf("get artifact: %w", storage.ErrStorage)
	}
	return a, true, nil
}

func (s *PostgresStorage) List(ctx context.Context) ([]model.Artifact, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := conn.Query(ctx, `
		SELECT id, filename, content_type, size_bytes, s3_key, created_at
		FROM artifacts
		ORDER BY created_at DESC
	`)
	if err != nil {
		log.Printf("artifact storage: list: %v", err)
		return nil, fmt.Errorf("list artifacts: %w", storage.ErrStorage)
	}
	defer rows.Close()

	artifacts := make([]model.Artifact, 0)
	for rows.Next() {
		var a model.Artifact
		if err := rows.Scan(&a.ArtifactID, &a.Filename, &a.ContentType, &a.Size, &a.S3Key, &a.CreatedAt); err != nil {
			log.Printf("artifact storage: scan: %v", err)
			return nil, fmt.Errorf("list artifacts: %w", storage.ErrStorage)
		}
		artifacts = append(artifacts, a)
	}
	if err := rows.Err(); err != nil {
		log.Printf("artifact storage: iterate: %v", err)
		return nil, fmt.Errorf("list artifacts: %w", storage.ErrStorage)
	}
	return artifacts, nil
}

func (s *PostgresStorage) Delete(ctx context.Context, id uuid.UUID) (bool, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return false, err
	}

	tag, err := conn.Exec(ctx, `DELETE FROM artifacts WHERE id = $1`, id)
	if err != nil {
		log.Printf("artifact storage: delete %s: %v", id, err)
		return false, fmt.Errorf("delete artifact: %w", storage.ErrStorage)
	}
	return tag.RowsAffected() > 0, nil
}
