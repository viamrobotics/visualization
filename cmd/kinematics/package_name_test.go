package main

import (
	"testing"

	"go.viam.com/test"
)

func TestDefaultPackageName(t *testing.T) {
	for dir, want := range map[string]string{
		"out/My-Tool.v2": "mytoolv2",
		"kinematics":     "kinematics",
		"out/123abc":     "abc",
		"out/456":        "kinematics",
		"out/---":        "kinematics",
		"out/Snake_Case": "snake_case",
		"out/func":       "kinematics",
		".":              "kinematics",
	} {
		test.That(t, defaultPackageName(dir), test.ShouldEqual, want)
	}
}
