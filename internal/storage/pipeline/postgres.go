package pipelineStorage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/AnarCom/p-graph/internal/model"
	"github.com/AnarCom/p-graph/internal/storage"
)

type PostgresStorage struct {
	db storage.Conn
}

func NewPostgresStorage(db storage.Conn) *PostgresStorage {
	return &PostgresStorage{db: db}
}

func (s *PostgresStorage) GetNodeCatalog(ctx context.Context, version *string) (model.NodeCatalog, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return model.NodeCatalog{}, err
	}

	resolved, err := resolveCatalogVersion(ctx, conn, version)
	if err != nil {
		return model.NodeCatalog{}, err
	}

	rows, err := conn.Query(ctx, `
		SELECT t.type, t.version, t.title, t.description, t.category, t.status, t.inputs, t.outputs, t.config_schema
		FROM node_types t
		JOIN catalog_version_types cvt
		  ON cvt.node_type = t.type AND cvt.node_type_version = t.version
		WHERE cvt.catalog_version = $1
		ORDER BY t.type
	`, resolved)
	if err != nil {
		return model.NodeCatalog{}, fmt.Errorf("query node types: %w", err)
	}
	defer rows.Close()

	nodeTypes := make([]model.NodeTypeDefinition, 0)
	for rows.Next() {
		var row nodeTypeRow
		if err := rows.Scan(
			&row.Type, &row.Version, &row.Title, &row.Description,
			&row.Category, &row.Status, &row.Inputs, &row.Outputs, &row.Config,
		); err != nil {
			return model.NodeCatalog{}, fmt.Errorf("scan node type: %w", err)
		}
		nodeType, err := row.toModel()
		if err != nil {
			return model.NodeCatalog{}, fmt.Errorf("node type %s: %w", row.Type, err)
		}
		nodeTypes = append(nodeTypes, nodeType)
	}
	if err := rows.Err(); err != nil {
		return model.NodeCatalog{}, fmt.Errorf("iterate node types: %w", err)
	}

	return model.NodeCatalog{CatalogVersion: resolved, NodeTypes: nodeTypes}, nil
}

func resolveCatalogVersion(ctx context.Context, conn storage.Conn, version *string) (string, error) {
	if version != nil {
		var exists bool
		err := conn.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM catalog_versions WHERE version = $1)`,
			*version,
		).Scan(&exists)
		if err != nil {
			return "", fmt.Errorf("check catalog version: %w", err)
		}
		if !exists {
			return "", ErrNodeCatalogNotFound
		}
		return *version, nil
	}

	var latest string
	err := conn.QueryRow(ctx,
		`SELECT version FROM catalog_versions ORDER BY released_at DESC LIMIT 1`,
	).Scan(&latest)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNodeCatalogNotFound
	}
	if err != nil {
		return "", fmt.Errorf("resolve latest catalog version: %w", err)
	}
	return latest, nil
}

func (s *PostgresStorage) GetDraft(ctx context.Context, pipelineID uuid.UUID) (model.PipelineDraft, bool, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return model.PipelineDraft{}, false, err
	}

	var (
		baseRevision   pgtype.Int8
		definitionJSON []byte
	)
	err = conn.QueryRow(ctx, `
		SELECT d.base_revision, d.definition
		FROM pipelines p
		LEFT JOIN pipeline_drafts d ON d.pipeline_id = p.id
		WHERE p.id = $1
	`, pipelineID).Scan(&baseRevision, &definitionJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.PipelineDraft{}, false, ErrPipelineNotFound
	}
	if err != nil {
		return model.PipelineDraft{}, false, fmt.Errorf("get pipeline draft: %w", err)
	}
	if definitionJSON == nil {
		return model.PipelineDraft{}, false, nil
	}

	draft, err := draftFromJSON(pipelineID.String(), nullInt64Ptr(baseRevision), definitionJSON)
	if err != nil {
		return model.PipelineDraft{}, false, err
	}
	return draft, true, nil
}

func (s *PostgresStorage) GetLatestRevision(ctx context.Context, pipelineID uuid.UUID) (model.PipelineDraft, bool, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return model.PipelineDraft{}, false, err
	}

	var (
		revision       int64
		definitionJSON []byte
	)
	err = conn.QueryRow(ctx, `
		SELECT revision, definition
		FROM pipeline_revisions
		WHERE pipeline_id = $1
		ORDER BY revision DESC
		LIMIT 1
	`, pipelineID).Scan(&revision, &definitionJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.PipelineDraft{}, false, nil
	}
	if err != nil {
		return model.PipelineDraft{}, false, fmt.Errorf("get latest revision: %w", err)
	}

	draft, err := draftFromJSON(pipelineID.String(), &revision, definitionJSON)
	if err != nil {
		return model.PipelineDraft{}, false, err
	}
	return draft, true, nil
}

func (s *PostgresStorage) UpsertDraft(ctx context.Context, pipelineID uuid.UUID, draft model.PipelineDraft) error {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return err
	}

	definitionJSON, err := json.Marshal(definitionFromModel(draft.Definition))
	if err != nil {
		return fmt.Errorf("marshal definition: %w", err)
	}

	var baseRevision any
	if draft.BaseRevision != nil {
		baseRevision = *draft.BaseRevision
	}

	_, err = conn.Exec(ctx, `
		INSERT INTO pipeline_drafts (pipeline_id, base_revision, definition, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (pipeline_id) DO UPDATE
		SET base_revision = EXCLUDED.base_revision,
		    definition = EXCLUDED.definition,
		    updated_at = now()
	`, pipelineID, baseRevision, definitionJSON)
	if isForeignKeyViolation(err) {
		return ErrPipelineNotFound
	}
	if err != nil {
		return fmt.Errorf("upsert pipeline draft: %w", err)
	}
	return nil
}

func (s *PostgresStorage) DeleteDraft(ctx context.Context, pipelineID uuid.UUID) error {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return err
	}

	if _, err := conn.Exec(ctx,
		`DELETE FROM pipeline_drafts WHERE pipeline_id = $1`,
		pipelineID,
	); err != nil {
		return fmt.Errorf("delete pipeline draft: %w", err)
	}
	return nil
}

func (s *PostgresStorage) PipelineExists(ctx context.Context, pipelineID uuid.UUID) (bool, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return false, err
	}

	var exists bool
	if err := conn.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM pipelines WHERE id = $1)`,
		pipelineID,
	).Scan(&exists); err != nil {
		return false, fmt.Errorf("check pipeline: %w", err)
	}
	return exists, nil
}

func nullInt64Ptr(v pgtype.Int8) *int64 {
	if !v.Valid {
		return nil
	}
	return &v.Int64
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
