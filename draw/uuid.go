package draw

import (
	"fmt"

	"github.com/google/uuid"
)

// uuidNamespace is the namespace UUID used for deterministic UUID generation
var uuidNamespace = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

type uuidConfig struct {
	uuid []byte
}

func newUuidConfig(name string, parent string) *uuidConfig {
	key := fmt.Sprintf("%s:%s", name, parent)
	id := uuid.NewSHA1(uuidNamespace, []byte(key))
	return &uuidConfig{
		uuid: id[:],
	}
}

// UuidOption is a function that configures a UUID configuration.
type UuidOption func(*uuidConfig)

// WithUUID creates a UUID option that sets the UUID.
func WithUUID(uuid []byte) UuidOption {
	return func(config *uuidConfig) {
		config.uuid = uuid
	}
}

// WithID creates a UUID option that generates a UUID from the given ID.
func WithID(id string) UuidOption {
	fromID := uuid.NewSHA1(uuidNamespace, []byte(id))
	return func(config *uuidConfig) {
		config.uuid = fromID[:]
	}
}
