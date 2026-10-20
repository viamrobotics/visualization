package xacro

import (
	"errors"
	"fmt"
	"math"
)

type mathFunction struct {
	minArgs, maxArgs int
	apply            func(args []float64) (float64, error)
}

func unary(apply func(float64) float64) mathFunction {
	return mathFunction{1, 1, func(args []float64) (float64, error) { return apply(args[0]), nil }}
}

// checked rejects a result that is NaN, which Python raises as a math domain error.
func checked(apply func(float64) float64) mathFunction {
	return mathFunction{1, 1, func(args []float64) (float64, error) {
		result := apply(args[0])
		if math.IsNaN(result) {
			return 0, errors.New("math domain error")
		}
		return result, nil
	}}
}

func extreme(pick func(a, b float64) float64) mathFunction {
	return mathFunction{1, -1, func(args []float64) (float64, error) {
		result := args[0]
		for _, arg := range args[1:] {
			result = pick(result, arg)
		}
		return result, nil
	}}
}

var mathFunctions = map[string]mathFunction{
	"radians": unary(func(degrees float64) float64 { return degrees * math.Pi / 180 }),
	"degrees": unary(func(radians float64) float64 { return radians * 180 / math.Pi }),
	"sin":     unary(math.Sin),
	"cos":     unary(math.Cos),
	"tan":     unary(math.Tan),
	"asin":    checked(math.Asin),
	"acos":    checked(math.Acos),
	"atan":    unary(math.Atan),
	"sqrt":    checked(math.Sqrt),
	"abs":     unary(math.Abs),
	"fabs":    unary(math.Abs),
	"floor":   unary(math.Floor),
	"ceil":    unary(math.Ceil),
	"min":     extreme(math.Min),
	"max":     extreme(math.Max),
	"atan2": {2, 2, func(args []float64) (float64, error) {
		return math.Atan2(args[0], args[1]), nil
	}},
}

// truthy follows Python: zero, false, and the empty string are falsy.
func truthy(v value) bool {
	switch typed := v.(type) {
	case float64:
		return typed != 0
	case bool:
		return typed
	case string:
		return typed != ""
	}
	return v != nil
}

// toNumber reads a float64 or a bool, which Python treats as 1 and 0.
func toNumber(v value) (float64, error) {
	switch typed := v.(type) {
	case float64:
		return typed, nil
	case bool:
		if typed {
			return 1, nil
		}
		return 0, nil
	}
	return 0, fmt.Errorf("%v is not a number", v)
}

func binary(operator string, left, right node) node {
	return func() (value, error) {
		a, err := left()
		if err != nil {
			return nil, err
		}
		b, err := right()
		if err != nil {
			return nil, err
		}
		return arithmetic(operator, a, b)
	}
}

func arithmetic(operator string, a, b value) (value, error) {
	if first, ok := a.(string); ok && operator == "+" {
		if second, ok := b.(string); ok {
			return first + second, nil
		}
	}
	x, err := toNumber(a)
	if err != nil {
		return nil, fmt.Errorf("%v %s %v: %w", a, operator, b, err)
	}
	y, err := toNumber(b)
	if err != nil {
		return nil, fmt.Errorf("%v %s %v: %w", a, operator, b, err)
	}
	switch operator {
	case "+":
		return x + y, nil
	case "-":
		return x - y, nil
	case "*":
		return x * y, nil
	case "**":
		result := math.Pow(x, y)
		if math.IsNaN(result) {
			return nil, fmt.Errorf("%v ** %v is not a real number", x, y)
		}
		return result, nil
	}
	if y == 0 {
		return nil, errors.New("division by zero")
	}
	switch operator {
	case "/":
		return x / y, nil
	case "//":
		return math.Floor(x / y), nil
	}
	// Python's % takes the sign of the divisor.
	remainder := math.Mod(x, y)
	if remainder != 0 && (remainder < 0) != (y < 0) {
		remainder += y
	}
	return remainder, nil
}

func compare(operator string, a, b value) (bool, error) {
	if first, ok := a.(string); ok {
		if second, ok := b.(string); ok {
			return order(operator, compareStrings(first, second)), nil
		}
	}
	x, errX := toNumber(a)
	y, errY := toNumber(b)
	if errX != nil || errY != nil {
		switch operator {
		case "==":
			return false, nil
		case "!=":
			return true, nil
		}
		return false, fmt.Errorf("cannot order %v and %v", a, b)
	}
	switch {
	case x < y:
		return order(operator, -1), nil
	case x > y:
		return order(operator, 1), nil
	case x == y:
		return order(operator, 0), nil
	}
	// NaN is unordered, so every comparison but != is false.
	return operator == "!=", nil
}

func compareStrings(a, b string) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}

func order(operator string, sign int) bool {
	switch operator {
	case "==":
		return sign == 0
	case "!=":
		return sign != 0
	case "<":
		return sign < 0
	case ">":
		return sign > 0
	case "<=":
		return sign <= 0
	}
	return sign >= 0
}
