package client

import (
	"encoding/json"
)

// RemoveAllSpatialObjects clears all drawn items from the visualizer.
//
// Parameters:
//   - names: A list of names of items to clear
func RemoveAllSpatialObjects() error {
	data := map[string]interface{}{}

	json, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return postHTTP(json, "json", "remove-all")
}
