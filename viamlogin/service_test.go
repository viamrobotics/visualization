package viamlogin

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"
	"go.viam.com/test"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	viamloginv1 "github.com/viamrobotics/visualization/viamlogin/v1"
	"github.com/viamrobotics/visualization/viamlogin/v1/viamloginv1connect"
)

// newAuthServer stands in for Viam's auth server. respond writes the reply to each request, after
// the form is parsed.
func newAuthServer(t *testing.T, respond func(w http.ResponseWriter, r *http.Request)) string {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		test.That(t, r.ParseForm(), test.ShouldBeNil)
		respond(w, r)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func newLoginClient(t *testing.T, authDomain string) viamloginv1connect.ViamLoginServiceClient {
	t.Helper()

	mux := http.NewServeMux()
	path, handler := viamloginv1connect.NewViamLoginServiceHandler(NewService(authDomain))
	mux.Handle(path, handler)

	srv := httptest.NewUnstartedServer(h2c.NewHandler(mux, &http2.Server{}))
	srv.Start()
	t.Cleanup(srv.Close)

	h2cTransport := &http2.Transport{
		AllowHTTP: true,
		DialTLSContext: func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, network, addr)
		},
	}

	return viamloginv1connect.NewViamLoginServiceClient(
		&http.Client{Transport: h2cTransport},
		srv.URL,
		connect.WithGRPC(),
	)
}

func writeJSON(t *testing.T, w http.ResponseWriter, status int, body any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	test.That(t, json.NewEncoder(w).Encode(body), test.ShouldBeNil)
}

func connectCode(t *testing.T, err error) connect.Code {
	t.Helper()
	var connectErr *connect.Error
	test.That(t, errors.As(err, &connectErr), test.ShouldBeTrue)
	return connectErr.Code()
}

func TestStartLogin(t *testing.T) {
	authDomain := newAuthServer(t, func(w http.ResponseWriter, r *http.Request) {
		test.That(t, r.URL.Path, test.ShouldEqual, deviceAuthorizationPath)
		test.That(t, r.PostForm.Get("client_id"), test.ShouldEqual, clientID)
		test.That(t, r.PostForm.Get("scope"), test.ShouldContainSubstring, "offline_access")
		writeJSON(t, w, http.StatusOK, map[string]any{
			"device_code":               "device-secret",
			"user_code":                 "WDJB-MJHT",
			"verification_uri_complete": "https://auth.viam.com/oauth2/device?user_code=WDJB-MJHT",
			"expires_in":                600,
			"interval":                  5,
		})
	})

	res, err := newLoginClient(t, authDomain).StartLogin(context.Background(), connect.NewRequest(&viamloginv1.StartLoginRequest{}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, res.Msg.GetDeviceCode(), test.ShouldEqual, "device-secret")
	test.That(t, res.Msg.GetUserCode(), test.ShouldEqual, "WDJB-MJHT")
	test.That(t, res.Msg.GetVerificationUriComplete(), test.ShouldEqual, "https://auth.viam.com/oauth2/device?user_code=WDJB-MJHT")
	test.That(t, res.Msg.GetExpiresInSeconds(), test.ShouldEqual, 600)
	test.That(t, res.Msg.GetIntervalSeconds(), test.ShouldEqual, 5)
}

func TestPollLoginNotYetApproved(t *testing.T) {
	tests := []struct {
		oauthError string
		expected   viamloginv1.LoginStatus
	}{
		{"authorization_pending", viamloginv1.LoginStatus_LOGIN_STATUS_PENDING},
		{"slow_down", viamloginv1.LoginStatus_LOGIN_STATUS_SLOW_DOWN},
	}
	for _, tc := range tests {
		t.Run(tc.oauthError, func(t *testing.T) {
			authDomain := newAuthServer(t, func(w http.ResponseWriter, _ *http.Request) {
				writeJSON(t, w, http.StatusBadRequest, map[string]string{"error": tc.oauthError})
			})

			res, err := newLoginClient(t, authDomain).PollLogin(context.Background(), connect.NewRequest(&viamloginv1.PollLoginRequest{DeviceCode: "device-secret"}))
			test.That(t, err, test.ShouldBeNil)
			test.That(t, res.Msg.GetStatus(), test.ShouldEqual, tc.expected)
			test.That(t, res.Msg.GetSession(), test.ShouldBeNil)
		})
	}
}

func TestPollLoginFailures(t *testing.T) {
	tests := []struct {
		oauthError string
		expected   connect.Code
	}{
		{"expired_token", connect.CodeDeadlineExceeded},
		{"access_denied", connect.CodePermissionDenied},
		{"invalid_client", connect.CodeUnavailable},
	}
	for _, tc := range tests {
		t.Run(tc.oauthError, func(t *testing.T) {
			authDomain := newAuthServer(t, func(w http.ResponseWriter, _ *http.Request) {
				writeJSON(t, w, http.StatusBadRequest, map[string]string{"error": tc.oauthError})
			})

			_, err := newLoginClient(t, authDomain).PollLogin(context.Background(), connect.NewRequest(&viamloginv1.PollLoginRequest{DeviceCode: "device-secret"}))
			test.That(t, connectCode(t, err), test.ShouldEqual, tc.expected)
		})
	}
}

func TestPollLoginApproved(t *testing.T) {
	authDomain := newAuthServer(t, func(w http.ResponseWriter, r *http.Request) {
		test.That(t, r.URL.Path, test.ShouldEqual, tokenPath)
		test.That(t, r.PostForm.Get("grant_type"), test.ShouldEqual, deviceCodeGrantType)
		test.That(t, r.PostForm.Get("device_code"), test.ShouldEqual, "device-secret")
		writeJSON(t, w, http.StatusOK, map[string]any{
			"access_token":  "access",
			"refresh_token": "refresh",
			"id_token": fakeJWT(t, map[string]string{
				"email":       "user@example.com",
				"given_name":  "Ada",
				"family_name": "Lovelace",
			}),
			"expires_in": 1800,
		})
	})

	res, err := newLoginClient(t, authDomain).PollLogin(context.Background(), connect.NewRequest(&viamloginv1.PollLoginRequest{DeviceCode: "device-secret"}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, res.Msg.GetStatus(), test.ShouldEqual, viamloginv1.LoginStatus_LOGIN_STATUS_APPROVED)
	test.That(t, res.Msg.GetSession().GetAccessToken(), test.ShouldEqual, "access")
	test.That(t, res.Msg.GetSession().GetRefreshToken(), test.ShouldEqual, "refresh")
	test.That(t, res.Msg.GetSession().GetExpiresInSeconds(), test.ShouldEqual, 1800)
	test.That(t, res.Msg.GetSession().GetEmail(), test.ShouldEqual, "user@example.com")
	test.That(t, res.Msg.GetSession().GetDisplayName(), test.ShouldEqual, "Ada Lovelace")
}

func TestRefreshLoginKeepsRefreshTokenWhenOmitted(t *testing.T) {
	authDomain := newAuthServer(t, func(w http.ResponseWriter, r *http.Request) {
		test.That(t, r.PostForm.Get("grant_type"), test.ShouldEqual, refreshTokenGrantType)
		writeJSON(t, w, http.StatusOK, map[string]any{"access_token": "new-access", "expires_in": 1800})
	})

	res, err := newLoginClient(t, authDomain).RefreshLogin(context.Background(), connect.NewRequest(&viamloginv1.RefreshLoginRequest{RefreshToken: "refresh"}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, res.Msg.GetSession().GetAccessToken(), test.ShouldEqual, "new-access")
	test.That(t, res.Msg.GetSession().GetRefreshToken(), test.ShouldEqual, "refresh")
}

func TestRefreshLoginRevokedToken(t *testing.T) {
	authDomain := newAuthServer(t, func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(t, w, http.StatusBadRequest, map[string]string{"error": "invalid_grant"})
	})

	_, err := newLoginClient(t, authDomain).RefreshLogin(context.Background(), connect.NewRequest(&viamloginv1.RefreshLoginRequest{RefreshToken: "revoked"}))
	test.That(t, connectCode(t, err), test.ShouldEqual, connect.CodeUnauthenticated)
}
