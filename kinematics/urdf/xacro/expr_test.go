package xacro

import (
	"errors"
	"math"
	"testing"

	"go.viam.com/test"
)

func testNames(name string) (value, bool) {
	known := map[string]value{
		"width":  0.5,
		"name":   "arm",
		"flag":   true,
		"off":    false,
		"count":  3.0,
		"empty":  "",
		"origin": "0 0 1",
	}
	found, ok := known[name]
	return found, ok
}

func testDirectives(name string, args []string) (string, error) {
	switch name {
	case "find":
		return "/pkgs/" + args[0], nil
	case "arg":
		return "arg:" + args[0], nil
	}
	return "", &UnsupportedError{Feature: "$(" + name + ")"}
}

func TestLiteral(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		expected value
	}{
		{"integer", "3", 3.0},
		{"float", "-0.25", -0.25},
		{"exponent", "1e3", 1000.0},
		{"true", "true", true},
		{"True", "True", true},
		{"false", "false", false},
		{"False", "False", false},
		{"quoted text loses quotes", "'12'", "12"},
		{"underscore stays text", "1_000", "1_000"},
		{"plain text", "base_link", "base_link"},
		{"mixed text", "1 2 3", "1 2 3"},
		{"hex stays text", "0x10", "0x10"},
		{"empty", "", ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			test.That(t, literal(tc.text), test.ShouldEqual, tc.expected)
		})
	}
}

func TestFormatValue(t *testing.T) {
	tests := []struct {
		name     string
		input    value
		expected string
	}{
		{"integral has no decimal point", 2.0, "2"},
		{"negative integral", -7.0, "-7"},
		{"fraction", 0.5, "0.5"},
		{"zero", 0.0, "0"},
		{"small uses exponent", 1e-7, "1e-07"},
		{"true", true, "True"},
		{"false", false, "False"},
		{"string", "abc", "abc"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			test.That(t, formatValue(tc.input), test.ShouldEqual, tc.expected)
		})
	}

	for _, number := range []float64{math.Pi / 2, 1e-7, 123456.789, 1e20, 0.1 + 0.2} {
		parsed, ok := literal(formatValue(number)).(float64)
		test.That(t, ok, test.ShouldBeTrue)
		test.That(t, parsed, test.ShouldEqual, number)
	}
}

func TestCondition(t *testing.T) {
	tests := []struct {
		name     string
		input    value
		expected bool
		fails    bool
	}{
		{"true bool", true, true, false},
		{"false bool", false, false, false},
		{"nonzero number", 2.0, true, false},
		{"zero number", 0.0, false, false},
		{"true text", "true", true, false},
		{"True text", "True", true, false},
		{"false text", "false", false, false},
		{"False text", "False", false, false},
		{"integer text", "1", true, false},
		{"zero text", "0", false, false},
		{"other text", "maybe", false, true},
		{"float text", "1.5", false, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := condition(tc.input)
			if tc.fails {
				test.That(t, err, test.ShouldNotBeNil)
				return
			}
			test.That(t, err, test.ShouldBeNil)
			test.That(t, got, test.ShouldEqual, tc.expected)
		})
	}
	_, err := condition("maybe")
	test.That(t, err.Error(), test.ShouldContainSubstring, "maybe")
}

func TestEvaluate(t *testing.T) {
	tests := []struct {
		name     string
		expr     string
		expected value
	}{
		{"number", "2", 2.0},
		{"decimal", ".5", 0.5},
		{"exponent number", "1e-3", 0.001},
		{"single quoted string", "'abc'", "abc"},
		{"double quoted string", `"abc"`, "abc"},
		{"name", "width", 0.5},
		{"pi", "pi", math.Pi},
		{"e", "e", math.E},
		{"True constant", "True", true},
		{"precedence", "1 + 2 * 3", 7.0},
		{"parentheses", "(1 + 2) * 3", 9.0},
		{"subtraction", "10 - 4 - 3", 3.0},
		{"division", "7 / 2", 3.5},
		{"floor division", "7 // 2", 3.0},
		{"negative floor division", "-7 // 2", -4.0},
		{"modulo", "7 % 3", 1.0},
		{"modulo takes divisor sign", "-7 % 3", 2.0},
		{"power", "2 ** 10", 1024.0},
		{"power is right associative", "2 ** 3 ** 2", 512.0},
		{"unary minus binds looser than power", "-2 ** 2", -4.0},
		{"negative exponent", "2 ** -1", 0.5},
		{"unary minus", "-width", -0.5},
		{"double negative", "--3", 3.0},
		{"unary plus", "+3", 3.0},
		{"radians", "radians(90)", math.Pi / 2},
		{"degrees", "degrees(pi)", 180.0},
		{"pi over two", "3.141592653589793/2", math.Pi / 2},
		{"sin", "sin(0)", 0.0},
		{"cos", "cos(0)", 1.0},
		{"tan", "tan(0)", 0.0},
		{"asin", "asin(1)", math.Pi / 2},
		{"acos", "acos(1)", 0.0},
		{"atan", "atan(0)", 0.0},
		{"atan2", "atan2(1, 1)", math.Pi / 4},
		{"sqrt", "sqrt(16)", 4.0},
		{"abs", "abs(-3)", 3.0},
		{"fabs", "fabs(-3.5)", 3.5},
		{"floor", "floor(2.7)", 2.0},
		{"ceil", "ceil(2.1)", 3.0},
		{"min", "min(3, 1, 2)", 1.0},
		{"max", "max(3, 1, 2)", 3.0},
		{"nested calls", "sqrt(abs(-9)) + 1", 4.0},
		{"string concatenation", "name + '_link'", "arm_link"},
		{"equal", "1 == 1", true},
		{"not equal", "1 != 1", false},
		{"less than", "1 < 2", true},
		{"greater than", "1 > 2", false},
		{"less or equal", "2 <= 2", true},
		{"greater or equal", "1 >= 2", false},
		{"chained comparison", "1 < 2 < 3", true},
		{"chained comparison fails", "1 < 3 < 2", false},
		{"string equality", "name == 'arm'", true},
		{"mixed types are unequal", "name == 1", false},
		{"string ordering", "'a' < 'b'", true},
		{"and", "flag and off", false},
		{"or", "off or flag", true},
		{"not", "not off", true},
		{"and returns deciding operand", "count and 'yes'", "yes"},
		{"or returns first truthy operand", "empty or 'fallback'", "fallback"},
		{"or short circuits past an unknown name", "flag or missing", true},
		{"and short circuits past an unknown name", "off and missing", false},
		{"x or y keeps x", "count or width", 3.0},
		{"conditional true", "'a' if flag else 'b'", "a"},
		{"conditional false", "'a' if off else 'b'", "b"},
		{"conditional skips the untaken branch", "1 if flag else missing", 1.0},
		{"nested conditional", "1 if off else 2 if flag else 3", 2.0},
		{"bool as number", "flag + 1", 2.0},
		{"whitespace", "  1 +\t2 ", 3.0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := evaluate(tc.expr, testNames)
			test.That(t, err, test.ShouldBeNil)
			if want, ok := tc.expected.(float64); ok {
				gotNumber, isNumber := got.(float64)
				test.That(t, isNumber, test.ShouldBeTrue)
				test.That(t, math.Abs(gotNumber-want), test.ShouldBeLessThan, 1e-12)
				return
			}
			test.That(t, got, test.ShouldEqual, tc.expected)
		})
	}
}

func TestEvaluateErrors(t *testing.T) {
	tests := []struct {
		name      string
		expr      string
		substring string
	}{
		{"unknown name", "missing + 1", `"missing"`},
		{"division by zero", "1 / 0", "division by zero"},
		{"sqrt of negative", "sqrt(-1)", "domain"},
		{"wrong arity", "atan2(1)", "atan2"},
		{"unterminated string", "'abc", "unterminated"},
		{"trailing token", "1 2", "unexpected"},
		{"missing parenthesis", "(1 + 2", ")"},
		{"stray character", "1 ? 2", "unexpected character"},
		{"conditional without else", "1 if flag", "else"},
		{"string times string", "name * name", "not a number"},
		{"ordering mixed types", "name < 1", "cannot order"},
		{"empty expression", "", "unexpected"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := evaluate(tc.expr, testNames)
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.substring)
			var unsupportedErr *UnsupportedError
			test.That(t, errors.As(err, &unsupportedErr), test.ShouldBeFalse)
		})
	}
}

func TestEvaluateUnsupported(t *testing.T) {
	tests := []struct {
		name    string
		expr    string
		feature string
	}{
		{"load_yaml method", "xacro.load_yaml('limits.yaml')", "xacro.load_yaml"},
		{"bare load_yaml", "load_yaml('limits.yaml')", "xacro.load_yaml"},
		{"attribute access", "math.pi", "math.pi"},
		{"unknown function", "frobnicate(1)", "frobnicate()"},
		{"subscript", "width[0]", "subscript"},
		{"subscript after call", "min(1, 2)[0]", "subscript"},
		{"list literal", "[1, 2]", "list literal"},
		{"dict literal", "{'a': 1}", "dict literal"},
		{"lambda", "lambda x: x", "lambda"},
		{"in operator", "1 in name", "in"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := evaluate(tc.expr, testNames)
			var unsupportedErr *UnsupportedError
			test.That(t, errors.As(err, &unsupportedErr), test.ShouldBeTrue)
			test.That(t, unsupportedErr.Feature, test.ShouldEqual, tc.feature)
			test.That(t, unsupportedErr.File, test.ShouldEqual, "")
			test.That(t, unsupportedErr.Entry, test.ShouldEqual, "")
		})
	}
}

func TestInterpolate(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		expected string
	}{
		{"no markup", "plain text", "plain text"},
		{"expression", "${width}", "0.5"},
		{"integral result", "${1 + 1}", "2"},
		{"embedded expression", "link_${count}_end", "link_3_end"},
		{"two expressions", "${1} ${2}", "1 2"},
		{"string result", "${name + '_link'}", "arm_link"},
		{"bool result", "${flag}", "True"},
		{"radians", "${radians(90)}", "1.5707963267948966"},
		{"pi over two", "${3.141592653589793/2}", "1.5707963267948966"},
		{"conditional", "${'a' if flag else 'b'}", "a"},
		{"brace inside a string", "${'}' + name}", "}arm"},
		{"escaped expression", "$${escaped}", "${escaped}"},
		{"escaped directive", "$$(find pkg)", "$(find pkg)"},
		{"find directive", "$(find pkg)/meshes/a.stl", "/pkgs/pkg/meshes/a.stl"},
		{"arg directive", "$(arg robot_name)", "arg:robot_name"},
		{"lone dollar", "cost $5", "cost $5"},
		{"trailing dollar", "5$", "5$"},
		{"escape beside expression", "$${a} ${count}", "${a} 3"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := interpolate(tc.text, testNames, testDirectives)
			test.That(t, err, test.ShouldBeNil)
			test.That(t, got, test.ShouldEqual, tc.expected)
		})
	}
}

func TestInterpolateErrors(t *testing.T) {
	tests := []struct {
		name      string
		text      string
		substring string
	}{
		{"unclosed expression", "${width", "unclosed"},
		{"unclosed directive", "$(find pkg", "unclosed"},
		{"unknown name", "${missing}", `"missing"`},
		{"empty directive", "$()", "empty"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := interpolate(tc.text, testNames, testDirectives)
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.substring)
		})
	}
}

func TestInterpolateUnsupported(t *testing.T) {
	_, err := interpolate("$(env HOME)", testNames, testDirectives)
	var unsupportedErr *UnsupportedError
	test.That(t, errors.As(err, &unsupportedErr), test.ShouldBeTrue)
	test.That(t, unsupportedErr.Feature, test.ShouldEqual, "$(env)")

	_, err = interpolate("${xacro.load_yaml('limits.yaml')}", testNames, testDirectives)
	test.That(t, errors.As(err, &unsupportedErr), test.ShouldBeTrue)
	test.That(t, unsupportedErr.Feature, test.ShouldEqual, "xacro.load_yaml")
}

func TestInterpolateValue(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		expected value
	}{
		{"single expression keeps number", "${width * 2}", 1.0},
		{"single expression keeps bool", "${count > 1}", true},
		{"single expression keeps string", "${name}", "arm"},
		{"plain number text", "0.25", 0.25},
		{"plain bool text", "true", true},
		{"plain text", "base_link", "base_link"},
		{"expression with prefix becomes text", "x${count}", "x3"},
		{"two expressions become text", "${count} ${count}", "3 3"},
		{"interpolated number text reads as a number", "${count}${count}", 33.0},
		{"quoted text loses quotes", "'${count}'", "3"},
		{"escaped expression stays text", "$${count}", "${count}"},
		{"directive result is text", "$(find pkg)", "/pkgs/pkg"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := interpolateValue(tc.text, testNames, testDirectives)
			test.That(t, err, test.ShouldBeNil)
			test.That(t, got, test.ShouldEqual, tc.expected)
		})
	}
}

func TestInterpolateValueErrors(t *testing.T) {
	_, err := interpolateValue("${missing}", testNames, testDirectives)
	test.That(t, err, test.ShouldNotBeNil)

	_, err = interpolateValue("${width", testNames, testDirectives)
	test.That(t, err, test.ShouldNotBeNil)

	_, err = interpolateValue("${xacro.load_yaml('a.yaml')}", testNames, testDirectives)
	var unsupportedErr *UnsupportedError
	test.That(t, errors.As(err, &unsupportedErr), test.ShouldBeTrue)
}

func TestEvaluatePiShadowedByProperty(t *testing.T) {
	names := func(name string) (value, bool) {
		if name == "pi" {
			return 3.0, true
		}
		return nil, false
	}
	got, err := evaluate("pi * 2", names)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, got, test.ShouldEqual, 6.0)
}
