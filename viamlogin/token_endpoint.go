package viamlogin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// oauthError is an OAuth error response body (RFC 6749 section 5.2, RFC 8628 section 3.5).
type oauthError struct {
	Code        string `json:"error"`
	Description string `json:"error_description"`
}

func (e *oauthError) Error() string {
	if e.Description == "" {
		return e.Code
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Description)
}

// Maximum response body read from the auth server, far above any real token response.
const maxResponseBytes = 1 << 20

// postForm POSTs form-encoded values to endpoint and decodes a 200 JSON body into out. A non-200
// response that parses as an OAuth error comes back as *oauthError.
func postForm(ctx context.Context, client *http.Client, endpoint string, values url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("posting to %s: %w", endpoint, err)
	}
	defer func() { _ = res.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(res.Body, maxResponseBytes))
	if err != nil {
		return fmt.Errorf("reading response from %s: %w", endpoint, err)
	}

	if res.StatusCode != http.StatusOK {
		var oauthErr oauthError
		if json.Unmarshal(body, &oauthErr) == nil && oauthErr.Code != "" {
			return &oauthErr
		}
		return fmt.Errorf("%s returned status %d", endpoint, res.StatusCode)
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("decoding response from %s: %w", endpoint, err)
	}
	return nil
}

// oauthErrorCode is the OAuth error code carried by err, or "" when err is not an OAuth error.
func oauthErrorCode(err error) string {
	var oauthErr *oauthError
	if errors.As(err, &oauthErr) {
		return oauthErr.Code
	}
	return ""
}
