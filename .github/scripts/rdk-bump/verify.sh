#!/usr/bin/env bash
# Runs every gate an RDK bump can break and records each result instead of stopping at the first
# failure, so one run shows the whole picture.
#
# Per RDK module: the pin reached <version>, go.mod is tidy, and the module builds and vets.
# Then the root Go tests, the RDK golden generators, golangci-lint on the packages CI lints, and
# the TypeScript gates, whose golden specs compare the hand-ported math against RDK's output.
#
# Usage: verify.sh <version> <out-dir>
# Writes <out-dir>/<gate>.log for each gate and <out-dir>/summary.md, a markdown table of results.
# Prints one line per gate, plus the tail of each failing log. Exits 1 if any gate failed.
set -uo pipefail

version=$1
out_dir=$(mkdir -p "$2" && cd "$2" && pwd)
script_dir=$(cd "$(dirname "$0")" && pwd)
cd "$(git rev-parse --show-toplevel)"

summary="$out_dir/summary.md"
any_failed=0
printf '| Gate | Command | Result |\n| --- | --- | --- |\n' > "$summary"

# run_gate <name> <dir> <command...>
run_gate() {
	local name=$1 dir=$2
	shift 2
	local log="$out_dir/${name//[^A-Za-z0-9_.-]/_}.log"
	local result

	if (cd "$dir" && "$@") > "$log" 2>&1; then
		result=pass
	else
		result=FAIL
		any_failed=1
	fi

	echo "$result $name"
	if [ "$result" = FAIL ]; then
		echo "  last 30 lines of $log:"
		tail -n 30 "$log" | sed 's/^/    /'
	fi
	printf '| %s | `%s` in `%s` | %s |\n' "$name" "$*" "$dir" "$result" >> "$summary"
}

# check_pin <dir>: the module's RDK requirement is at or past <version>.
check_pin() {
	local current newest
	current=$(cd "$1" && go list -m -f '{{.Version}}' go.viam.com/rdk) || return 1
	newest=$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -n1)
	echo "go.viam.com/rdk is $current, target $version"
	[ "$newest" = "$current" ]
}

for module_dir in $("$script_dir/list-modules.sh"); do
	label=$module_dir
	[ "$module_dir" = . ] && label=root

	run_gate "pin $label" . check_pin "$module_dir"
	run_gate "tidy $label" "$module_dir" go mod tidy -diff
	# -o /dev/null: a module whose ./... is one main package otherwise writes its binary in place.
	run_gate "build $label" "$module_dir" go build -o /dev/null ./...
	run_gate "vet $label" "$module_dir" go vet ./...
done

run_gate 'go test root' . go test -count=1 ./...
run_gate 'rdk goldens' . pnpm test:rdk-golden
run_gate 'golangci-lint draw' . pnpm lint:draw
run_gate 'golangci-lint scenes' . pnpm lint:scenes
run_gate 'vitest' . pnpm test
run_gate 'svelte-check' . pnpm check

exit "$any_failed"
