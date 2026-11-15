package pipelineStorage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

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
		log.Printf("pipeline storage: query node types: %v", err)
		return model.NodeCatalog{}, fmt.Errorf("query node types: %w", storage.ErrStorage)
	}
	defer rows.Close()

	nodeTypes := make([]model.NodeTypeDefinition, 0)
	for rows.Next() {
		var row nodeTypeRow
		if err := rows.Scan(
			&row.Type, &row.Version, &row.Title, &row.Description,
			&row.Category, &row.Status, &row.Inputs, &row.Outputs, &row.Config,
		); err != nil {
			log.Printf("pipeline storage: scan node type: %v", err)
			return model.NodeCatalog{}, fmt.Errorf("scan node type: %w", storage.ErrStorage)
		}
		nodeType, err := row.toModel()
		if err != nil {
			log.Printf("pipeline storage: node type %s: %v", row.Type, err)
			return model.NodeCatalog{}, fmt.Errorf("convert node type: %w", storage.ErrStorage)
		}
		nodeTypes = append(nodeTypes, nodeType)
	}
	if err := rows.Err(); err != nil {
		log.Printf("pipeline storage: iterate node types: %v", err)
		return model.NodeCatalog{}, fmt.Errorf("iterate node types: %w", storage.ErrStorage)
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
			log.Printf("pipeline storage: check catalog version: %v", err)
			return "", fmt.Errorf("check catalog version: %w", storage.ErrStorage)
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
		log.Printf("pipeline storage: resolve latest catalog version: %v", err)
		return "", fmt.Errorf("resolve latest catalog version: %w", storage.ErrStorage)
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
		log.Printf("pipeline storage: get pipeline draft %s: %v", pipelineID, err)
		return model.PipelineDraft{}, false, fmt.Errorf("get pipeline draft: %w", storage.ErrStorage)
	}
	if definitionJSON == nil {
		return model.PipelineDraft{}, false, nil
	}

	draft, err := draftFromJSON(pipelineID.String(), nullInt64Ptr(baseRevision), definitionJSON)
	if err != nil {
		log.Printf("pipeline storage: unmarshal draft %s: %v", pipelineID, err)
		return model.PipelineDraft{}, false, fmt.Errorf("unmarshal pipeline draft: %w", storage.ErrStorage)
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
		log.Printf("pipeline storage: get latest revision %s: %v", pipelineID, err)
		return model.PipelineDraft{}, false, fmt.Errorf("get latest revision: %w", storage.ErrStorage)
	}

	draft, err := draftFromJSON(pipelineID.String(), &revision, definitionJSON)
	if err != nil {
		log.Printf("pipeline storage: unmarshal revision %s: %v", pipelineID, err)
		return model.PipelineDraft{}, false, fmt.Errorf("unmarshal pipeline revision: %w", storage.ErrStorage)
	}
	return draft, true, nil
}

func (s *PostgresStorage) GetRevision(ctx context.Context, pipelineID uuid.UUID, revision int32) (model.PipelineDraft, bool, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return model.PipelineDraft{}, false, err
	}

	var (
		rev            int64
		definitionJSON []byte
	)
	err = conn.QueryRow(ctx, `
		SELECT revision, definition
		FROM pipeline_revisions
		WHERE pipeline_id = $1 AND revision = $2
	`, pipelineID, revision).Scan(&rev, &definitionJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.PipelineDraft{}, false, nil
	}
	if err != nil {
		log.Printf("pipeline storage: get pipeline revision %s/%d: %v", pipelineID, revision, err)
		return model.PipelineDraft{}, false, fmt.Errorf("get pipeline revision: %w", storage.ErrStorage)
	}

	draft, err := draftFromJSON(pipelineID.String(), &rev, definitionJSON)
	if err != nil {
		log.Printf("pipeline storage: unmarshal revision %s/%d: %v", pipelineID, revision, err)
		return model.PipelineDraft{}, false, fmt.Errorf("unmarshal pipeline revision: %w", storage.ErrStorage)
	}
	return draft, true, nil
}

func (s *PostgresStorage) CreateRevision(ctx context.Context, pipelineID uuid.UUID, draft model.PipelineDraft) (int32, error) {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return 0, err
	}

	definitionJSON, err := json.Marshal(definitionFromModel(draft.Definition))
	if err != nil {
		log.Printf("pipeline storage: marshal definition: %v", err)
		return 0, fmt.Errorf("marshal definition: %w", storage.ErrStorage)
	}

	var revision int32
	err = conn.QueryRow(ctx, `
		INSERT INTO pipeline_revisions (pipeline_id, revision, definition)
		SELECT $1, COALESCE(MAX(revision), 0) + 1, $2
		FROM pipeline_revisions
		WHERE pipeline_id = $1
		RETURNING revision
	`, pipelineID, definitionJSON).Scan(&revision)
	if err != nil {
		log.Printf("pipeline storage: create pipeline revision %s: %v", pipelineID, err)
		return 0, fmt.Errorf("create pipeline revision: %w", storage.ErrStorage)
	}
	return revision, nil
}

func (s *PostgresStorage) UpsertDraft(ctx context.Context, pipelineID uuid.UUID, draft model.PipelineDraft) error {
	conn, err := storage.ExecutorFrom(ctx)
	if err != nil {
		return err
	}

	definitionJSON, err := json.Marshal(definitionFromModel(draft.Definition))
	if err != nil {
		log.Printf("pipeline storage: marshal definition: %v", err)
		return fmt.Errorf("marshal definition: %w", storage.ErrStorage)
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
		log.Printf("pipeline storage: upsert pipeline draft %s: %v", pipelineID, err)
		return fmt.Errorf("upsert pipeline draft: %w", storage.ErrStorage)
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
		log.Printf("pipeline storage: delete pipeline draft %s: %v", pipelineID, err)
		return fmt.Errorf("delete pipeline draft: %w", storage.ErrStorage)
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
		log.Printf("pipeline storage: check pipeline %s: %v", pipelineID, err)
		return false, fmt.Errorf("check pipeline: %w", storage.ErrStorage)
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
