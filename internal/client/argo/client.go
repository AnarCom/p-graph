package argo

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
)

type ArgoClient struct {
	serverURL string
	namespace string
	http      *http.Client
}

func NewArgoClient(serverURL, namespace string) *ArgoClient {
	return &ArgoClient{
		serverURL: serverURL,
		namespace: namespace,
		http: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		},
	}
}

type submitRequest struct {
	Namespace string          `json:"namespace"`
	Workflow  json.RawMessage `json:"workflow"`
}

type submitResponse struct {
	Metadata struct {
		Name string `json:"name"`
	} `json:"metadata"`
}

func (c *ArgoClient) SubmitWorkflow(ctx context.Context, workflow json.RawMessage) (string, error) {
	body, err := json.Marshal(submitRequest{
		Namespace: c.namespace,
		Workflow:  workflow,
	})
	if err != nil {
		return "", fmt.Errorf("marshal workflow: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/workflows/%s", c.serverURL, c.namespace)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	var out submitResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if out.Metadata.Name == "" {
		return "", fmt.Errorf("empty workflow name in response")
	}

	return out.Metadata.Name, nil
}
