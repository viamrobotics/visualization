package xacro

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// value is a property, arg, or macro-param value: float64, bool, or string.
type value any

// lookup resolves a name in an expression. ok is false for an undefined name.
type lookup func(name string) (v value, ok bool)

// directive resolves `$(name args...)`: `$(find pkg)` and `$(arg name)`. Any other name returns an
// *UnsupportedError.
type directive func(name string, args []string) (string, error)

// exponentFormatBelow and exponentFormatFrom bound the magnitudes written in plain decimal. Outside
// them a float is written with an exponent, which strconv.ParseFloat reads back exactly.
const (
	exponentFormatBelow = 1e-4
	exponentFormatFrom  = 1e16
)

// literal converts document text to a value the way xacro reads a property: a number when it parses
// as one, a bool for `true`/`false`/`True`/`False`, else the text itself.
func literal(text string) value {
	if len(text) >= 2 && text[0] == '\'' && text[len(text)-1] == '\'' {
		return text[1 : len(text)-1]
	}
	if strings.Contains(text, "_") {
		return text
	}
	trimmed := strings.TrimSpace(text)
	// ParseFloat also reads hex floats, which Python's float() does not.
	if !strings.ContainsAny(trimmed, "xXpP") {
		if number, err := strconv.ParseFloat(trimmed, 64); err == nil {
			return number
		}
	}
	switch text {
	case "true", "True":
		return true
	case "false", "False":
		return false
	}
	return text
}

// formatValue writes a value into the document: a number in a form strconv.ParseFloat reads back
// exactly, with no decimal point when it is integral, a bool as `True`/`False` the way xacro writes
// one, and a string as it is.
func formatValue(v value) string {
	switch typed := v.(type) {
	case float64:
		magnitude := math.Abs(typed)
		if magnitude != 0 && !math.IsInf(typed, 0) && (magnitude < exponentFormatBelow || magnitude >= exponentFormatFrom) {
			return strconv.FormatFloat(typed, 'g', -1, 64)
		}
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case bool:
		if typed {
			return "True"
		}
		return "False"
	case string:
		return typed
	}
	return fmt.Sprint(v)
}

// condition reads an `xacro:if`/`xacro:unless` value the way xacro does: a bool as itself, a number
// as nonzero, `true`/`True` and `false`/`False`, or text that parses as an integer. Anything else is an
// error naming the value.
func condition(v value) (bool, error) {
	switch typed := v.(type) {
	case bool:
		return typed, nil
	case float64:
		return typed != 0, nil
	case string:
		switch typed {
		case "true", "True":
			return true, nil
		case "false", "False":
			return false, nil
		}
		if number, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64); err == nil {
			return number != 0, nil
		}
		return false, fmt.Errorf("condition %q is not a boolean", typed)
	}
	return false, fmt.Errorf("condition %v is not a boolean", v)
}

// interpolate replaces every `${expr}` and `$(directive)` in text. `$${` and `$$(` write a literal `${`
// and `$(`.
func interpolate(text string, names lookup, directives directive) (string, error) {
	var out strings.Builder
	for i := 0; i < len(text); {
		if text[i] != '$' || i+1 >= len(text) {
			out.WriteByte(text[i])
			i++
			continue
		}
		next := text[i+1]
		switch {
		case next == '$' && i+2 < len(text) && (text[i+2] == '{' || text[i+2] == '('):
			out.WriteString(text[i+1 : i+3])
			i += 3
		case next == '{' || next == '(':
			end, err := closing(text, i+1)
			if err != nil {
				return "", err
			}
			body := text[i+2 : end]
			if next == '{' {
				result, err := evaluate(body, names)
				if err != nil {
					return "", fmt.Errorf("evaluating ${%s}: %w", body, err)
				}
				out.WriteString(formatValue(result))
			} else {
				result, err := runDirective(body, directives)
				if err != nil {
					return "", err
				}
				out.WriteString(result)
			}
			i = end + 1
		default:
			out.WriteByte('$')
			i++
		}
	}
	return out.String(), nil
}

// interpolateValue is interpolate for a property value or macro argument: text that is exactly one
// `${expr}` keeps the expression's typed value, and any other text becomes literal(interpolated).
func interpolateValue(text string, names lookup, directives directive) (value, error) {
	if strings.HasPrefix(text, "${") {
		end, err := closing(text, 1)
		if err != nil {
			return nil, err
		}
		if end == len(text)-1 {
			result, err := evaluate(text[2:end], names)
			if err != nil {
				return nil, fmt.Errorf("evaluating %s: %w", text, err)
			}
			return result, nil
		}
	}
	interpolated, err := interpolate(text, names, directives)
	if err != nil {
		return nil, err
	}
	return literal(interpolated), nil
}

func runDirective(body string, directives directive) (string, error) {
	fields := strings.Fields(body)
	if len(fields) == 0 {
		return "", errors.New("empty $() directive")
	}
	return directives(fields[0], fields[1:])
}

// closing returns the index of the bracket that closes the one at text[open], skipping quoted text
// and nested brackets of the same kind.
func closing(text string, open int) (int, error) {
	opener := text[open]
	closer := byte('}')
	if opener == '(' {
		closer = ')'
	}
	depth := 0
	var quote byte
	for i := open; i < len(text); i++ {
		char := text[i]
		switch {
		case quote != 0:
			if char == '\\' {
				i++
			} else if char == quote {
				quote = 0
			}
		case char == '\'' || char == '"':
			quote = char
		case char == opener:
			depth++
		case char == closer:
			depth--
			if depth == 0 {
				return i, nil
			}
		}
	}
	return 0, fmt.Errorf("unclosed `$%c` in %q", opener, text)
}
