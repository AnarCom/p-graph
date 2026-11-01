package pipelineHandler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/AnarCom/p-graph/internal/api"
	genapi "github.com/AnarCom/p-graph/internal/api/gen"
	"github.com/AnarCom/p-graph/internal/migrator"
	pipelineSvc "github.com/AnarCom/p-graph/internal/service/pipeline"
	"github.com/AnarCom/p-graph/internal/storage"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
	"github.com/AnarCom/p-graph/migrations"
)

const demoPipelineID = "20000000-0000-4000-8000-000000000000"

const unknownPipelineID = "30000000-0000-4000-8000-000000000000"

const savedDraftBody = `{
	"pipelineId": "` + demoPipelineID + `",
	"baseRevision": null,
	"definition": {
		"schemaVersion": "v1",
		"nodeCatalogVersion": "0.1",
		"inputs": {},
		"nodes": [
			{"id": "n1", "type": "builtin.file-input", "typeVersion": 1, "title": "input", "config": {}}
		],
		"edges": []
	}
}`

const definitionBody = `{
	"schemaVersion": "v1",
	"nodeCatalogVersion": "0.1",
	"inputs": {},
	"nodes": [],
	"edges": []
}`

func setupServer(t *testing.T) *httptest.Server {
	t.Helper()
	ctx := context.Background()

	pg, err := postgres.Run(ctx, "postgres:16-alpine",
		postgres.WithDatabase("pgraph"),
		postgres.WithUsername("pgraph"),
		postgres.WithPassword("pgraph"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Skipf("postgres container unavailable: %v", err)
	}
	t.Cleanup(func() {
		_ = pg.Terminate(ctx)
	})

	dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	m, err := migrator.NewMigrator(migrations.FS, ".")
	if err != nil {
		t.Fatal(err)
	}
	sqlDB := stdlib.OpenDBFromPool(pool)
	if err := m.ApplyMigrations(sqlDB); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close sql db: %v", err)
	}

	store := pipelineStorage.NewPostgresStorage(pool)
	tx := storage.NewTransactor(pool)
	svc := pipelineSvc.NewService(store, tx)

	server := httptest.NewServer(api.NewMux(NewPipelineHandler(svc)))
	t.Cleanup(server.Close)

	return server
}

func doRequest(t *testing.T, server *httptest.Server, method, path, body string) (int, []byte) {
	t.Helper()

	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, server.URL+path, reader)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, raw
}

func TestIntegration(t *testing.T) {
	server := setupServer(t)

	t.Run("health", func(t *testing.T) {
		code, body := doRequest(t, server, http.MethodGet, "/health", "")
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", code, body)
		}
		if !strings.Contains(string(body), `"ok"`) {
			t.Fatalf("body = %s, want status ok", body)
		}
	})

	t.Run("node catalog", func(t *testing.T) {
		code, body := doRequest(t, server, http.MethodGet, "/node-catalog", "")
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", code, body)
		}

		var catalog genapi.NodeCatalog
		if err := json.Unmarshal(body, &catalog); err != nil {
			t.Fatalf("unmarshal catalog: %v", err)
		}
		if catalog.CatalogVersion != "0.1" {
			t.Errorf("catalogVersion = %q, want 0.1", catalog.CatalogVersion)
		}
		if len(catalog.NodeTypes) == 0 {
			t.Error("nodeTypes is empty")
		}
	})

	t.Run("node catalog unknown version", func(t *testing.T) {
		code, _ := doRequest(t, server, http.MethodGet, "/node-catalog?version=9.9", "")
		if code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("get draft falls back to latest revision", func(t *testing.T) {
		code, body := doRequest(t, server, http.MethodGet, "/pipelines/"+demoPipelineID+"/draft", "")
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", code, body)
		}

		var draft genapi.PipelineDraft
		if err := json.Unmarshal(body, &draft); err != nil {
			t.Fatalf("unmarshal draft: %v", err)
		}
		if draft.BaseRevision == nil || *draft.BaseRevision != 1 {
			t.Errorf("baseRevision = %v, want 1", draft.BaseRevision)
		}
	})

	t.Run("get draft invalid uuid", func(t *testing.T) {
		code, _ := doRequest(t, server, http.MethodGet, "/pipelines/not-a-uuid/draft", "")
		if code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("get draft unknown pipeline", func(t *testing.T) {
		code, _ := doRequest(t, server, http.MethodGet, "/pipelines/"+unknownPipelineID+"/draft", "")
		if code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("save draft", func(t *testing.T) {
		code, body := doRequest(t, server, http.MethodPut, "/pipelines/"+demoPipelineID+"/draft", savedDraftBody)
		if code != http.StatusNoContent {
			t.Fatalf("status = %d, want 204, body: %s", code, body)
		}

		code, body = doRequest(t, server, http.MethodGet, "/pipelines/"+demoPipelineID+"/draft", "")
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", code, body)
		}

		var draft genapi.PipelineDraft
		if err := json.Unmarshal(body, &draft); err != nil {
			t.Fatalf("unmarshal draft: %v", err)
		}
		if len(draft.Definition.Nodes) != 1 || draft.Definition.Nodes[0].Id != "n1" {
			t.Errorf("draft nodes = %+v, want single node n1", draft.Definition.Nodes)
		}
	})

	t.Run("save draft stale base revision", func(t *testing.T) {
		stale := strings.Replace(savedDraftBody, `"baseRevision": null`, `"baseRevision": 999`, 1)
		code, _ := doRequest(t, server, http.MethodPut, "/pipelines/"+demoPipelineID+"/draft", stale)
		if code != http.StatusConflict {
			t.Fatalf("status = %d, want 409", code)
		}
	})

	t.Run("save draft unknown pipeline", func(t *testing.T) {
		body := strings.Replace(savedDraftBody, demoPipelineID, unknownPipelineID, 1)
		code, _ := doRequest(t, server, http.MethodPut, "/pipelines/"+unknownPipelineID+"/draft", body)
		if code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", code)
		}
	})

	t.Run("reset draft", func(t *testing.T) {
		code, body := doRequest(t, server, http.MethodDelete, "/pipelines/"+demoPipelineID+"/draft", "")
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", code, body)
		}

		var draft genapi.PipelineDraft
		if err := json.Unmarshal(body, &draft); err != nil {
			t.Fatalf("unmarshal draft: %v", err)
		}
		if draft.BaseRevision == nil || *draft.BaseRevision != 1 {
			t.Errorf("baseRevision = %v, want 1", draft.BaseRevision)
		}

		code, body = doRequest(t, server, http.MethodGet, "/pipelines/"+demoPipelineID+"/draft", "")
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200 after reset, body: %s", code, body)
		}
	})

	t.Run("validate draft", func(t *testing.T) {
		code, body := doRequest(t, server, http.MethodPost, "/pipelines/"+demoPipelineID+"/validate", definitionBody)
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", code, body)
		}

		var result genapi.ValidationResult
		if err := json.Unmarshal(body, &result); err != nil {
			t.Fatalf("unmarshal result: %v", err)
		}
		if !result.Valid {
			t.Errorf("valid = false, want true, body: %s", body)
		}
	})

	t.Run("validate draft invalid uuid", func(t *testing.T) {
		code, _ := doRequest(t, server, http.MethodPost, "/pipelines/not-a-uuid/validate", definitionBody)
		if code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", code)
		}
	})
}
