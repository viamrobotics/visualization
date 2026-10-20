package urdf

import (
	"fmt"
	"strings"
)

const (
	rootID       = "root"
	tcpID        = "tcp"
	originSuffix = "_origin"
	linkSuffix   = "_link"
	jointSuffix  = "_joint"
)

// idNamer hands out spec ids that are unique across links and joints and avoid the reserved ids.
type idNamer struct {
	taken   map[string]bool
	renamed []string
}

func newIDNamer() *idNamer {
	return &idNamer{taken: map[string]bool{}}
}

func isReservedID(id string) bool {
	return id == rootID || id == tcpID || strings.HasSuffix(id, originSuffix)
}

// claim returns id, or id with suffix when id is reserved or already taken. Renames are recorded.
func (namer *idNamer) claim(id, suffix string) string {
	chosen := id
	for attempt := 2; isReservedID(chosen) || namer.taken[chosen]; attempt++ {
		chosen = id + suffix
		if attempt > 2 {
			chosen = fmt.Sprintf("%s%s_%d", id, suffix, attempt)
		}
	}
	namer.taken[chosen] = true
	if chosen != id {
		namer.renamed = append(namer.renamed, id+" -> "+chosen)
	}
	return chosen
}
