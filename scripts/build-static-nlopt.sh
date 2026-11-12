#!/usr/bin/env bash
# Builds nlopt 2.10.0 from source as a static library, C API only, into <prefix>.
#
# Usage: scripts/build-static-nlopt.sh <prefix> [osx-architecture]
#   prefix             install directory. The library lands at <prefix>/lib/libnlopt.a.
#   osx-architecture   CMAKE_OSX_ARCHITECTURES on macOS (arm64 or x86_64), for cross-building.
#
# Needs git, cmake, and a C compiler. Exits non-zero when a step fails or libnlopt.a is missing
# after the install.
set -euo pipefail

NLOPT_VERSION=v2.10.0

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "usage: $0 <prefix> [osx-architecture]" >&2
    exit 2
fi

prefix="$1"
osx_architecture="${2:-}"
source_dir="$(mktemp -d)"
trap 'rm -rf "$source_dir"' EXIT

git clone --quiet --depth 1 --branch "$NLOPT_VERSION" https://github.com/stevengj/nlopt "$source_dir"

cmake_args=(
    -DBUILD_SHARED_LIBS=OFF
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON
    -DCMAKE_INSTALL_LIBDIR=lib
    # RDK's IK uses only LD_SLSQP, a C algorithm. The C++ API and every binding turn on a
    # configure check that includes <ciso646>, which current libc++ no longer ships.
    -DNLOPT_CXX=OFF
    -DNLOPT_PYTHON=OFF -DNLOPT_OCTAVE=OFF -DNLOPT_MATLAB=OFF -DNLOPT_GUILE=OFF
    -DNLOPT_JAVA=OFF -DNLOPT_SWIG=OFF -DNLOPT_TESTS=OFF
    -DCMAKE_INSTALL_PREFIX="$prefix"
)
if [ -n "$osx_architecture" ]; then
    cmake_args+=(-DCMAKE_OSX_ARCHITECTURES="$osx_architecture")
fi

cmake -S "$source_dir" -B "$source_dir/out" "${cmake_args[@]}" > /dev/null
cmake --build "$source_dir/out" --parallel > /dev/null
cmake --install "$source_dir/out" > /dev/null

test -f "$prefix/lib/libnlopt.a"
echo "static nlopt: $prefix/lib/libnlopt.a"
