package client

import (
	"encoding/json"
)

// RemoveSpatialObjects clears a list of drawn items.
//
// Parameters:
//   - names: A list of names of items to clear
func RemoveSpatialObjects(names []string) error {
	json, err := json.Marshal(names)

	if err != nil {
		return err
	}

	return postHTTP(json, "json", "remove")
}
