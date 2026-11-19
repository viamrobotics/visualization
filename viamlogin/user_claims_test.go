package viamlogin

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"go.viam.com/test"
)

func fakeJWT(t *testing.T, claims map[string]string) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	test.That(t, err, test.ShouldBeNil)
	return "header." + base64.RawURLEncoding.EncodeToString(payload) + ".signature"
}

func TestUserClaimsDisplayName(t *testing.T) {
	tests := []struct {
		name     string
		claims   userClaims
		expected string
	}{
		{"joins given and family name", userClaims{GivenName: "Ada", FamilyName: "Lovelace", Name: "ada"}, "Ada Lovelace"},
		{"falls back to preferred_username without a family name", userClaims{GivenName: "Ada", PreferredUsername: "ada.l", Name: "ada"}, "ada.l"},
		{"falls back to name last", userClaims{Name: "Ada L"}, "Ada L"},
		{"is empty with no name claims", userClaims{Email: "ada@example.com"}, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			test.That(t, tc.claims.displayName(), test.ShouldEqual, tc.expected)
		})
	}
}

func TestSessionClaimsPreferAccessToken(t *testing.T) {
	accessToken := fakeJWT(t, map[string]string{"given_name": "Ada", "family_name": "Lovelace"})
	idToken := fakeJWT(t, map[string]string{"email": "ada@example.com", "preferred_username": "ada"})

	claims := sessionClaims(accessToken, idToken)

	test.That(t, claims.displayName(), test.ShouldEqual, "Ada Lovelace")
	test.That(t, claims.Email, test.ShouldEqual, "ada@example.com")
}
