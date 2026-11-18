package viamlogin

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

// userClaims is the part of a token's payload that labels the session in the UI.
type userClaims struct {
	Email             string `json:"email"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`
	PreferredUsername string `json:"preferred_username"`
	Name              string `json:"name"`
}

// displayName follows app.viam.com: given and family name, else preferred_username, else name.
func (c userClaims) displayName() string {
	if c.GivenName != "" && c.FamilyName != "" {
		return c.GivenName + " " + c.FamilyName
	}
	if c.PreferredUsername != "" {
		return c.PreferredUsername
	}
	return c.Name
}

// orFallback fills each empty claim from fallback.
func (c userClaims) orFallback(fallback userClaims) userClaims {
	pick := func(value, alternative string) string {
		if value != "" {
			return value
		}
		return alternative
	}
	return userClaims{
		Email:             pick(c.Email, fallback.Email),
		GivenName:         pick(c.GivenName, fallback.GivenName),
		FamilyName:        pick(c.FamilyName, fallback.FamilyName),
		PreferredUsername: pick(c.PreferredUsername, fallback.PreferredUsername),
		Name:              pick(c.Name, fallback.Name),
	}
}

// sessionClaims reads the user's claims from the access token first, as app.viam.com does, since
// the ID token can lack the name claims. The ID token fills whatever the access token leaves empty.
func sessionClaims(accessToken, idToken string) userClaims {
	return parseJWTClaims(accessToken).orFallback(parseJWTClaims(idToken))
}

// parseJWTClaims reads a JWT's claims without verifying its signature. The token came straight
// from the auth server over TLS, and these claims only label the session in the UI, so they grant
// nothing. A malformed token yields empty claims.
func parseJWTClaims(token string) userClaims {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return userClaims{}
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return userClaims{}
	}

	var claims userClaims
	if json.Unmarshal(payload, &claims) != nil {
		return userClaims{}
	}
	return claims
}
