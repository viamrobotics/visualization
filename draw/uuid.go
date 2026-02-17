package draw

import (
	"fmt"

	"github.com/google/uuid"
)

var uuidNamespace = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

type uuidConfig struct {
	uuid []byte
}

func newUuidConfig(name string, parent string) uuidConfig {
	key := fmt.Sprintf("%s:%s", name, parent)
	id := uuid.NewSHA1(uuidNamespace, []byte(key))
	return uuidConfig{
		uuid: id[:],
	}
}

type uuidOption func(*uuidConfig)

func withUUID(uuid []byte) uuidOption {
	return func(config *uuidConfig) {
		config.uuid = uuid
	}
}

func withID(id string) uuidOption {
	fromID := uuid.NewSHA1(uuidNamespace, []byte(id))
	return func(config *uuidConfig) {
		config.uuid = fromID[:]
	}
}
