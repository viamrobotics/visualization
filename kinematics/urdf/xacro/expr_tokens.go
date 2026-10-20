package xacro

import (
	"fmt"
	"strings"
)

type tokenKind int

const (
	tokenEnd tokenKind = iota
	tokenNumber
	tokenString
	tokenName
	tokenOperator
)

type token struct {
	kind tokenKind
	text string
}

var twoCharOperators = []string{"**", "//", "==", "!=", "<=", ">="}

const oneCharOperators = "+-*/%<>(),[]{}.:"

func isDigit(char byte) bool { return char >= '0' && char <= '9' }

func isNameStart(char byte) bool {
	return char == '_' || (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

// tokenize splits an expression into numbers, quoted strings, names, and operators.
func tokenize(expr string) ([]token, error) {
	var tokens []token
	for i := 0; i < len(expr); {
		char := expr[i]
		switch {
		case char == ' ' || char == '\t' || char == '\n' || char == '\r':
			i++
		case isDigit(char) || (char == '.' && i+1 < len(expr) && isDigit(expr[i+1])):
			end := scanNumber(expr, i)
			tokens = append(tokens, token{tokenNumber, expr[i:end]})
			i = end
		case isNameStart(char):
			end := i
			for end < len(expr) && (isNameStart(expr[end]) || isDigit(expr[end])) {
				end++
			}
			tokens = append(tokens, token{tokenName, expr[i:end]})
			i = end
		case char == '\'' || char == '"':
			text, end, err := scanString(expr, i)
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, token{tokenString, text})
			i = end
		default:
			operator := scanOperator(expr[i:])
			if operator == "" {
				return nil, fmt.Errorf("unexpected character %q in %q", char, expr)
			}
			tokens = append(tokens, token{tokenOperator, operator})
			i += len(operator)
		}
	}
	return append(tokens, token{kind: tokenEnd}), nil
}

func scanNumber(expr string, start int) int {
	i := start
	for i < len(expr) && (isDigit(expr[i]) || expr[i] == '.') {
		i++
	}
	if i < len(expr) && (expr[i] == 'e' || expr[i] == 'E') {
		j := i + 1
		if j < len(expr) && (expr[j] == '+' || expr[j] == '-') {
			j++
		}
		if j < len(expr) && isDigit(expr[j]) {
			for j < len(expr) && isDigit(expr[j]) {
				j++
			}
			return j
		}
	}
	return i
}

func scanString(expr string, start int) (text string, end int, err error) {
	quote := expr[start]
	var out strings.Builder
	for i := start + 1; i < len(expr); i++ {
		switch {
		case expr[i] == '\\' && i+1 < len(expr):
			i++
			out.WriteByte(expr[i])
		case expr[i] == quote:
			return out.String(), i + 1, nil
		default:
			out.WriteByte(expr[i])
		}
	}
	return "", 0, fmt.Errorf("unterminated string in %q", expr)
}

func scanOperator(rest string) string {
	for _, operator := range twoCharOperators {
		if strings.HasPrefix(rest, operator) {
			return operator
		}
	}
	if strings.ContainsRune(oneCharOperators, rune(rest[0])) {
		return rest[:1]
	}
	return ""
}
