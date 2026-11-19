// Package viamlogin proxies Viam's OAuth device-code login for the local visualizer.
package viamlogin

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"time"

	"connectrpc.com/connect"
	viamloginv1 "github.com/viamrobotics/visualization/viamlogin/v1"
	"github.com/viamrobotics/visualization/viamlogin/v1/viamloginv1connect"
)

const (
	// DefaultAuthDomain is Viam's production auth server.
	DefaultAuthDomain = "https://auth.viam.com"

	// The Viam CLI's native OAuth client, which is registered for the device-code grant.
	clientID = "c1e41724-9b29-479f-abcc-7bfbe2e3309a"
	audience = clientID
	// offline_access is what makes the token response carry a refresh token.
	scopes = "email openid offline_access"

	deviceAuthorizationPath = "/oauth2/device_authorize"
	tokenPath               = "/oauth2/token"
	deviceCodeGrantType     = "urn:ietf:params:oauth:grant-type:device_code"
	refreshTokenGrantType   = "refresh_token"

	requestTimeout = 15 * time.Second
)

var _ viamloginv1connect.ViamLoginServiceHandler = (*Service)(nil)

// Service forwards device-code login requests to the auth server. It holds no tokens.
type Service struct {
	authDomain string
	httpClient *http.Client
}

// NewService returns a Service that talks to the auth server at authDomain, such as
// DefaultAuthDomain.
func NewService(authDomain string) *Service {
	return &Service{
		authDomain: authDomain,
		httpClient: &http.Client{Timeout: requestTimeout},
	}
}

type deviceCodeResponse struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int32  `json:"expires_in"`
	Interval                int32  `json:"interval"`
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
	ExpiresIn    int32  `json:"expires_in"`
}

// StartLogin requests a new device code.
func (s *Service) StartLogin(
	ctx context.Context,
	_ *connect.Request[viamloginv1.StartLoginRequest],
) (*connect.Response[viamloginv1.StartLoginResponse], error) {
	values := url.Values{
		"client_id": {clientID},
		"audience":  {audience},
		"scope":     {scopes},
	}

	var code deviceCodeResponse
	if err := postForm(ctx, s.httpClient, s.authDomain+deviceAuthorizationPath, values, &code); err != nil {
		return nil, connect.NewError(connect.CodeUnavailable, err)
	}

	return connect.NewResponse(&viamloginv1.StartLoginResponse{
		DeviceCode:              code.DeviceCode,
		UserCode:                code.UserCode,
		VerificationUriComplete: code.VerificationURIComplete,
		ExpiresInSeconds:        code.ExpiresIn,
		IntervalSeconds:         code.Interval,
	}), nil
}

// PollLogin asks the auth server once whether the user has approved the device code.
func (s *Service) PollLogin(
	ctx context.Context,
	req *connect.Request[viamloginv1.PollLoginRequest],
) (*connect.Response[viamloginv1.PollLoginResponse], error) {
	if req.Msg.GetDeviceCode() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("device code is required"))
	}

	values := url.Values{
		"client_id":   {clientID},
		"device_code": {req.Msg.GetDeviceCode()},
		"grant_type":  {deviceCodeGrantType},
	}

	session, err := s.requestSession(ctx, values)
	if err != nil {
		return pollFailure(err)
	}

	return connect.NewResponse(&viamloginv1.PollLoginResponse{
		Status:  viamloginv1.LoginStatus_LOGIN_STATUS_APPROVED,
		Session: session,
	}), nil
}

// pollFailure maps a token endpoint error during polling (RFC 8628 section 3.5). The pending and
// slow-down errors mean "not yet", so they come back as statuses rather than errors.
func pollFailure(err error) (*connect.Response[viamloginv1.PollLoginResponse], error) {
	switch oauthErrorCode(err) {
	case "authorization_pending":
		return pollStatus(viamloginv1.LoginStatus_LOGIN_STATUS_PENDING), nil
	case "slow_down":
		return pollStatus(viamloginv1.LoginStatus_LOGIN_STATUS_SLOW_DOWN), nil
	case "expired_token":
		return nil, connect.NewError(connect.CodeDeadlineExceeded, err)
	case "access_denied":
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	default:
		return nil, connect.NewError(connect.CodeUnavailable, err)
	}
}

// RefreshLogin exchanges a refresh token for a new session.
func (s *Service) RefreshLogin(
	ctx context.Context,
	req *connect.Request[viamloginv1.RefreshLoginRequest],
) (*connect.Response[viamloginv1.RefreshLoginResponse], error) {
	if req.Msg.GetRefreshToken() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("refresh token is required"))
	}

	values := url.Values{
		"client_id":     {clientID},
		"grant_type":    {refreshTokenGrantType},
		"refresh_token": {req.Msg.GetRefreshToken()},
	}

	session, err := s.requestSession(ctx, values)
	if oauthErrorCode(err) == "invalid_grant" {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeUnavailable, err)
	}

	return connect.NewResponse(&viamloginv1.RefreshLoginResponse{Session: session}), nil
}

// requestSession posts a grant to the token endpoint. A refresh response may omit the refresh
// token, in which case the one sent stays valid and is returned again.
func (s *Service) requestSession(ctx context.Context, values url.Values) (*viamloginv1.Session, error) {
	var token tokenResponse
	if err := postForm(ctx, s.httpClient, s.authDomain+tokenPath, values, &token); err != nil {
		return nil, err
	}
	if token.AccessToken == "" {
		return nil, errors.New("token response has no access token")
	}

	refreshToken := token.RefreshToken
	if refreshToken == "" {
		refreshToken = values.Get("refresh_token")
	}

	claims := sessionClaims(token.AccessToken, token.IDToken)
	return &viamloginv1.Session{
		AccessToken:      token.AccessToken,
		RefreshToken:     refreshToken,
		ExpiresInSeconds: token.ExpiresIn,
		Email:            claims.Email,
		DisplayName:      claims.displayName(),
	}, nil
}

func pollStatus(status viamloginv1.LoginStatus) *connect.Response[viamloginv1.PollLoginResponse] {
	return connect.NewResponse(&viamloginv1.PollLoginResponse{Status: status})
}
