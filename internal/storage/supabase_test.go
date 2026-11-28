package storage

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSetHeadersForNewSecretKey(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "https://example.test", nil)
	if err != nil {
		t.Fatal(err)
	}
	setHeaders(req, "sb_secret_test")
	if got := req.Header.Get("apikey"); got != "sb_secret_test" {
		t.Fatalf("apikey = %q, want secret key", got)
	}
	if got := req.Header.Get("Authorization"); got != "" {
		t.Fatalf("Authorization = %q, want empty for opaque secret key", got)
	}
}

func TestSetHeadersKeepsLegacyServiceRoleJWT(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "https://example.test", nil)
	if err != nil {
		t.Fatal(err)
	}
	setHeaders(req, "eyJ.legacy.jwt")
	if got := req.Header.Get("apikey"); got != "eyJ.legacy.jwt" {
		t.Fatalf("apikey = %q, want legacy JWT", got)
	}
	if got := req.Header.Get("Authorization"); got != "Bearer eyJ.legacy.jwt" {
		t.Fatalf("Authorization = %q, want Bearer legacy JWT", got)
	}
}

func TestUploadFallsBackAndReturnsFallbackURL(t *testing.T) {
	primaryCalls, fallbackCalls := 0, 0
	var fallbackAPIKey, fallbackAuthorization string
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		primaryCalls++
		http.Error(w, "storage capacity reached", http.StatusTooManyRequests)
	}))
	defer primary.Close()
	fallback := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fallbackCalls++
		fallbackAPIKey = r.Header.Get("apikey")
		fallbackAuthorization = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer fallback.Close()

	client := NewSupabaseWithFallback(primary.URL, "sb_secret_primary", fallback.URL, "sb_secret_fallback")
	got, err := client.Upload(context.Background(), "videos", "processed/a.mp4", "video/mp4", []byte("video"))
	if err != nil {
		t.Fatal(err)
	}
	if primaryCalls != 1 || fallbackCalls != 1 {
		t.Fatalf("upload attempts = primary:%d fallback:%d, want one each", primaryCalls, fallbackCalls)
	}
	if !strings.HasPrefix(got, fallback.URL+"/") {
		t.Fatalf("returned URL %q does not use fallback project", got)
	}
	if fallbackAPIKey != "sb_secret_fallback" || fallbackAuthorization != "" {
		t.Fatalf("fallback auth headers were not correct: apikey=%q authorization=%q", fallbackAPIKey, fallbackAuthorization)
	}
}

func TestSignedURLForSourceUsesOwningProject(t *testing.T) {
	primaryCalls, fallbackCalls := 0, 0
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		primaryCalls++
		http.Error(w, "wrong project", http.StatusInternalServerError)
	}))
	defer primary.Close()
	fallback := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fallbackCalls++
		if got := r.Header.Get("apikey"); got != "sb_secret_fallback" {
			t.Errorf("fallback apikey = %q", got)
		}
		if got := r.Header.Get("Authorization"); got != "" {
			t.Errorf("fallback Authorization = %q, want empty", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"signedURL":"/object/sign/videos/processed/a.mp4?token=ok"}`))
	}))
	defer fallback.Close()

	client := NewSupabaseWithFallback(primary.URL, "sb_secret_primary", fallback.URL, "sb_secret_fallback")
	got, err := client.SignedURLForSource(
		context.Background(),
		fallback.URL+"/storage/v1/object/public/videos/processed/a.mp4",
		"videos",
		"processed/a.mp4",
		3600,
	)
	if err != nil {
		t.Fatal(err)
	}
	if primaryCalls != 0 || fallbackCalls != 1 {
		t.Fatalf("signing calls = primary:%d fallback:%d, want primary:0 fallback:1", primaryCalls, fallbackCalls)
	}
	if !strings.HasPrefix(got, fallback.URL+"/storage/v1/") {
		t.Fatalf("signed URL %q does not use fallback project", got)
	}
}
