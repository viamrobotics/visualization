package xacro

import (
	"errors"
	"fmt"
	"math"
	"strconv"
)

// node computes one parsed subexpression. Building closures at parse time lets `and`, `or`, and
// `a if c else b` skip the branch they do not take, so a name used only there need not exist.
type node func() (value, error)

type parser struct {
	tokens []token
	pos    int
	names  lookup
}

// evaluate computes the body of a `${}` expression: numbers, quoted strings, names, `pi`, `radians()`,
// `degrees()`, `+ - * /` and unary minus, comparisons, `and`/`or`/`not`, and parentheses. A construct
// outside that, such as `xacro.load_yaml(...)`, returns an *UnsupportedError naming it.
func evaluate(expr string, names lookup) (value, error) {
	tokens, err := tokenize(expr)
	if err != nil {
		return nil, err
	}
	p := &parser{tokens: tokens, names: names}
	root, err := p.parseTernary()
	if err != nil {
		return nil, err
	}
	if extra := p.peek(); extra.kind != tokenEnd {
		return nil, fmt.Errorf("unexpected %q in %q", extra.text, expr)
	}
	return root()
}

func unsupported(feature string) error {
	return &UnsupportedError{Feature: feature}
}

func (p *parser) peek() token { return p.tokens[p.pos] }

func (p *parser) advance() token {
	current := p.tokens[p.pos]
	if current.kind != tokenEnd {
		p.pos++
	}
	return current
}

func (p *parser) peekIs(kind tokenKind, text string) bool {
	current := p.peek()
	return current.kind == kind && current.text == text
}

func (p *parser) acceptOperator(text string) bool {
	if p.peekIs(tokenOperator, text) {
		p.pos++
		return true
	}
	return false
}

func (p *parser) acceptKeyword(text string) bool {
	if p.peekIs(tokenName, text) {
		p.pos++
		return true
	}
	return false
}

func (p *parser) expectOperator(text string) error {
	if !p.acceptOperator(text) {
		return fmt.Errorf("expected %q, found %q", text, p.peek().text)
	}
	return nil
}

func (p *parser) parseTernary() (node, error) {
	result, err := p.parseOr()
	if err != nil || !p.acceptKeyword("if") {
		return result, err
	}
	test, err := p.parseOr()
	if err != nil {
		return nil, err
	}
	if !p.acceptKeyword("else") {
		return nil, errors.New("expected `else` after `if`")
	}
	alternative, err := p.parseTernary()
	if err != nil {
		return nil, err
	}
	return func() (value, error) {
		chosen, err := test()
		if err != nil {
			return nil, err
		}
		if truthy(chosen) {
			return result()
		}
		return alternative()
	}, nil
}

// parseOr and parseAnd return the deciding operand, as Python does, not a coerced bool.
func (p *parser) parseOr() (node, error) {
	left, err := p.parseAnd()
	for err == nil && p.acceptKeyword("or") {
		var right node
		if right, err = p.parseAnd(); err != nil {
			break
		}
		previous := left
		left = func() (value, error) {
			first, err := previous()
			if err != nil || truthy(first) {
				return first, err
			}
			return right()
		}
	}
	return left, err
}

func (p *parser) parseAnd() (node, error) {
	left, err := p.parseNot()
	for err == nil && p.acceptKeyword("and") {
		var right node
		if right, err = p.parseNot(); err != nil {
			break
		}
		previous := left
		left = func() (value, error) {
			first, err := previous()
			if err != nil || !truthy(first) {
				return first, err
			}
			return right()
		}
	}
	return left, err
}

func (p *parser) parseNot() (node, error) {
	if !p.acceptKeyword("not") {
		return p.parseComparison()
	}
	operand, err := p.parseNot()
	if err != nil {
		return nil, err
	}
	return func() (value, error) {
		inner, err := operand()
		return !truthy(inner), err
	}, nil
}

var comparisonOperators = map[string]bool{"==": true, "!=": true, "<": true, ">": true, "<=": true, ">=": true}

func (p *parser) parseComparison() (node, error) {
	first, err := p.parseSum()
	if err != nil {
		return nil, err
	}
	operands := []node{first}
	var operators []string
	for {
		current := p.peek()
		if current.kind == tokenName && (current.text == "in" || current.text == "is") {
			return nil, unsupported(current.text)
		}
		if current.kind != tokenOperator || !comparisonOperators[current.text] {
			break
		}
		p.pos++
		operand, err := p.parseSum()
		if err != nil {
			return nil, err
		}
		operators = append(operators, current.text)
		operands = append(operands, operand)
	}
	if len(operators) == 0 {
		return first, nil
	}
	// Python chains `a < b < c` as `a < b and b < c`, evaluating each operand once.
	return func() (value, error) {
		left, err := operands[0]()
		if err != nil {
			return nil, err
		}
		for index, operator := range operators {
			right, err := operands[index+1]()
			if err != nil {
				return nil, err
			}
			holds, err := compare(operator, left, right)
			if err != nil || !holds {
				return false, err
			}
			left = right
		}
		return true, nil
	}, nil
}

func (p *parser) parseSum() (node, error) {
	left, err := p.parseProduct()
	for err == nil && (p.peekIs(tokenOperator, "+") || p.peekIs(tokenOperator, "-")) {
		operator := p.advance().text
		var right node
		if right, err = p.parseProduct(); err != nil {
			break
		}
		left = binary(operator, left, right)
	}
	return left, err
}

func (p *parser) parseProduct() (node, error) {
	left, err := p.parseUnary()
	for err == nil && (p.peekIs(tokenOperator, "*") || p.peekIs(tokenOperator, "/") ||
		p.peekIs(tokenOperator, "//") || p.peekIs(tokenOperator, "%")) {
		operator := p.advance().text
		var right node
		if right, err = p.parseUnary(); err != nil {
			break
		}
		left = binary(operator, left, right)
	}
	return left, err
}

func (p *parser) parseUnary() (node, error) {
	negate := p.peekIs(tokenOperator, "-")
	if !negate && !p.peekIs(tokenOperator, "+") {
		return p.parsePower()
	}
	p.pos++
	operand, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	return func() (value, error) {
		inner, err := operand()
		if err != nil {
			return nil, err
		}
		number, err := toNumber(inner)
		if negate {
			number = -number
		}
		return number, err
	}, nil
}

// parsePower makes `**` right-associative and lets its exponent carry a sign, so `-2 ** 2` is -4
// and `2 ** -1` is 0.5.
func (p *parser) parsePower() (node, error) {
	base, err := p.parsePrimary()
	if err != nil || !p.acceptOperator("**") {
		return base, err
	}
	exponent, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	return binary("**", base, exponent), nil
}

func (p *parser) parsePrimary() (node, error) {
	current := p.advance()
	var result node
	var err error
	switch {
	case current.kind == tokenNumber:
		var number float64
		if number, err = strconv.ParseFloat(current.text, 64); err != nil {
			return nil, fmt.Errorf("invalid number %q", current.text)
		}
		result = constant(number)
	case current.kind == tokenString:
		result = constant(current.text)
	case current.kind == tokenName:
		result, err = p.parseName(current.text)
	case current.kind == tokenOperator && current.text == "(":
		if result, err = p.parseTernary(); err == nil {
			err = p.expectOperator(")")
		}
	case current.kind == tokenOperator && current.text == "[":
		return nil, unsupported("list literal")
	case current.kind == tokenOperator && current.text == "{":
		return nil, unsupported("dict literal")
	default:
		return nil, fmt.Errorf("unexpected %q", current.text)
	}
	if err != nil {
		return nil, err
	}
	if p.peekIs(tokenOperator, "[") {
		return nil, unsupported("subscript")
	}
	return result, nil
}

func (p *parser) parseName(name string) (node, error) {
	switch name {
	case "lambda":
		return nil, unsupported("lambda")
	case "if", "else", "and", "or", "in", "is":
		return nil, fmt.Errorf("unexpected %q", name)
	}
	if p.peekIs(tokenOperator, ".") {
		feature := name
		for p.acceptOperator(".") {
			attribute := p.advance()
			if attribute.kind != tokenName {
				return nil, fmt.Errorf("expected a name after %q.", feature)
			}
			feature += "." + attribute.text
		}
		return nil, unsupported(feature)
	}
	if p.acceptOperator("(") {
		return p.parseCall(name)
	}
	return p.variable(name), nil
}

func (p *parser) parseCall(name string) (node, error) {
	function, known := mathFunctions[name]
	if !known {
		if name == "load_yaml" {
			return nil, unsupported("xacro.load_yaml")
		}
		return nil, unsupported(name + "()")
	}
	var args []node
	for !p.acceptOperator(")") {
		if len(args) > 0 {
			if err := p.expectOperator(","); err != nil {
				return nil, err
			}
		}
		arg, err := p.parseTernary()
		if err != nil {
			return nil, err
		}
		args = append(args, arg)
	}
	if len(args) < function.minArgs || (function.maxArgs >= 0 && len(args) > function.maxArgs) {
		return nil, fmt.Errorf("%s() called with %d arguments", name, len(args))
	}
	return func() (value, error) {
		numbers := make([]float64, len(args))
		for index, arg := range args {
			evaluated, err := arg()
			if err != nil {
				return nil, err
			}
			if numbers[index], err = toNumber(evaluated); err != nil {
				return nil, fmt.Errorf("%s(): %w", name, err)
			}
		}
		result, err := function.apply(numbers)
		if err != nil {
			return nil, fmt.Errorf("%s(): %w", name, err)
		}
		return result, nil
	}, nil
}

// variable resolves a name through lookup first, so a property can shadow `pi`, `e`, and the bools.
func (p *parser) variable(name string) node {
	return func() (value, error) {
		if found, ok := p.names(name); ok {
			return found, nil
		}
		switch name {
		case "pi":
			return math.Pi, nil
		case "e":
			return math.E, nil
		case "True":
			return true, nil
		case "False":
			return false, nil
		}
		return nil, fmt.Errorf("unknown name %q", name)
	}
}

func constant(v value) node {
	return func() (value, error) { return v, nil }
}
