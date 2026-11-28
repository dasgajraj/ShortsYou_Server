package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

type SupabaseClient struct {
	baseURL     string
	apiKey      string
	fallbackURL string
	fallbackKey string
	http        *http.Client
}

func NewSupabase(baseURL, apiKey string) *SupabaseClient {
	fallbackURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL_FALLBACK")), "/")
	fallbackKey := strings.TrimSpace(os.Getenv("SUPABASE_KEY_FALLBACK"))
	if fallbackKey == "" {
		fallbackKey = strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY_FALLBACK"))
	}
	return NewSupabaseWithFallback(baseURL, apiKey, fallbackURL, fallbackKey)
}

func NewSupabaseWithFallback(baseURL, apiKey, fallbackURL, fallbackKey string) *SupabaseClient {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	fallbackURL = strings.TrimRight(strings.TrimSpace(fallbackURL), "/")
	fallbackKey = strings.TrimSpace(fallbackKey)
	if fallbackURL == strings.TrimRight(baseURL, "/") {
		fallbackURL, fallbackKey = "", ""
	}

	return &SupabaseClient{
		baseURL:     baseURL,
		apiKey:      apiKey,
		fallbackURL: fallbackURL,
		fallbackKey: fallbackKey,
		http: &http.Client{
			Timeout: 10 * time.Minute,
		},
	}
}

func (s *SupabaseClient) Upload(
	ctx context.Context,
	bucket string,
	objectPath string,
	contentType string,
	data []byte,
) (string, error) {
	if bucket == "" {
		return "", fmt.Errorf("bucket is required")
	}

	if objectPath == "" {
		return "", fmt.Errorf("object path is required")
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	targets := s.storageTargets()
	var lastErr error
	for _, target := range targets {
		endpoint := fmt.Sprintf(
			"%s/storage/v1/object/%s/%s",
			target.baseURL,
			url.PathEscape(bucket),
			escapeObjectPath(objectPath),
		)

		req, err := http.NewRequestWithContext(
			ctx,
			http.MethodPost,
			endpoint,
			bytes.NewReader(data),
		)
		if err != nil {
			return "", fmt.Errorf("build upload request: %w", err)
		}

		setHeaders(req, target.apiKey)

		req.Header.Set("Content-Type", contentType)
		req.Header.Set("x-upsert", "true")

		resp, err := s.http.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("supabase upload via %s: %w", target.name, err)
			continue
		}

		if resp.StatusCode != http.StatusOK &&
			resp.StatusCode != http.StatusCreated {
			raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
			resp.Body.Close()

			lastErr = fmt.Errorf(
				"supabase %s upload status %d: %s",
				target.name,
				resp.StatusCode,
				strings.TrimSpace(string(raw)),
			)
			continue
		}
		resp.Body.Close()

		return fmt.Sprintf(
			"%s/storage/v1/object/public/%s/%s",
			target.baseURL,
			url.PathEscape(bucket),
			escapeObjectPath(objectPath),
		), nil
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("supabase storage is not configured")
	}
	return "", lastErr
}

type storageTarget struct {
	name    string
	baseURL string
	apiKey  string
}

func (s *SupabaseClient) storageTargets() []storageTarget {
	targets := make([]storageTarget, 0, 2)
	if s.baseURL != "" && s.apiKey != "" {
		targets = append(targets, storageTarget{name: "primary", baseURL: s.baseURL, apiKey: s.apiKey})
	}
	if s.fallbackURL != "" && s.fallbackKey != "" {
		targets = append(targets, storageTarget{name: "fallback", baseURL: s.fallbackURL, apiKey: s.fallbackKey})
	}
	return targets
}

type signedURLResponse struct {
	SignedURL string `json:"signedURL"`
}

func (s *SupabaseClient) SignedURL(
	ctx context.Context,
	bucket string,
	objectPath string,
	expiresIn int,
) (string, error) {
	return s.signedURLAt(ctx, s.baseURL, s.apiKey, bucket, objectPath, expiresIn)
}

// SignedURLForSource signs an object with the project that owns sourceURL.
// Render uploads can land in the fallback project during a primary outage.
func (s *SupabaseClient) SignedURLForSource(
	ctx context.Context,
	sourceURL string,
	bucket string,
	objectPath string,
	expiresIn int,
) (string, error) {
	target := s.targetForSource(sourceURL)
	return s.signedURLAt(ctx, target.baseURL, target.apiKey, bucket, objectPath, expiresIn)
}

func (s *SupabaseClient) signedURLAt(
	ctx context.Context,
	baseURL string,
	apiKey string,
	bucket string,
	objectPath string,
	expiresIn int,
) (string, error) {
	if bucket == "" {
		return "", fmt.Errorf("bucket is required")
	}

	if objectPath == "" {
		return "", fmt.Errorf("object path is required")
	}

	if expiresIn <= 0 {
		return "", fmt.Errorf("expiresIn must be greater than zero")
	}

	endpoint := fmt.Sprintf(
		"%s/storage/v1/object/sign/%s/%s",
		baseURL,
		url.PathEscape(bucket),
		escapeObjectPath(objectPath),
	)

	body, err := json.Marshal(map[string]int{
		"expiresIn": expiresIn,
	})
	if err != nil {
		return "", fmt.Errorf("encode signed url request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		endpoint,
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("build signed url request: %w", err)
	}

	setHeaders(req, apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("supabase signed url: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))

		return "", fmt.Errorf(
			"supabase signed url status %d: %s",
			resp.StatusCode,
			strings.TrimSpace(string(raw)),
		)
	}

	var result signedURLResponse

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode signed url response: %w", err)
	}

	if result.SignedURL == "" {
		return "", fmt.Errorf("supabase returned empty signed URL")
	}

	if strings.HasPrefix(result.SignedURL, "http://") ||
		strings.HasPrefix(result.SignedURL, "https://") {
		return result.SignedURL, nil
	}

	return baseURL + "/storage/v1/" + strings.TrimLeft(result.SignedURL, "/"), nil
}

func (s *SupabaseClient) targetForSource(sourceURL string) storageTarget {
	parsed, err := url.Parse(sourceURL)
	if err == nil {
		for _, target := range s.storageTargets() {
			configured, parseErr := url.Parse(target.baseURL)
			if parseErr == nil && strings.EqualFold(parsed.Host, configured.Host) {
				return target
			}
		}
	}
	return storageTarget{name: "primary", baseURL: s.baseURL, apiKey: s.apiKey}
}

func setHeaders(req *http.Request, apiKey string) {
	if apiKey == "" {
		return
	}
	req.Header.Set("apikey", apiKey)
	// sb_* keys are opaque API keys, not JWTs, and must not be sent as Bearer.
	if !strings.HasPrefix(apiKey, "sb_") {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
}

func escapeObjectPath(objectPath string) string {
	objectPath = strings.Trim(objectPath, "/")

	if objectPath == "" {
		return ""
	}

	parts := strings.Split(objectPath, "/")

	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}

	return path.Join(parts...)
}