package urdf

import (
	"fmt"
	"strings"
)

// pickTCP returns the URDF link the TCP sits at, or empty when nothing matches. An explicit choice
// may be any link. The naming conventions only consider the candidates, which have no geometry.
func pickTCP(tree *linkTree, candidates []string, explicit string) (string, error) {
	if explicit != "" {
		if tree.links[explicit] == nil {
			return "", fmt.Errorf("TCP link %q is not a link of the URDF", explicit)
		}
		return explicit, nil
	}
	matchers := []func(name string) bool{
		func(name string) bool { return name == "tool0" },
		func(name string) bool { return strings.HasSuffix(strings.ToLower(name), "tcp") },
		func(name string) bool { return strings.Contains(strings.ToLower(name), "tcp") },
		func(name string) bool { return strings.Contains(strings.ToLower(name), "tool") },
	}
	for _, matches := range matchers {
		for _, name := range candidates {
			if matches(name) {
				return name, nil
			}
		}
	}
	return "", nil
}
