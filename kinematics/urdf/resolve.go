package urdf

import (
	"encoding/xml"
	"fmt"
	"io/fs"
	"path"
	"strings"
)

const (
	packageScheme = "package://"
	fileScheme    = "file://"
)

// meshResolver maps a URDF mesh filename to a path inside files.
type meshResolver struct {
	files    fs.FS
	urdfDir  string
	packages map[string]string
	dirs     map[string]string
	scanned  bool
	// xacro marks a URDF expanded from xacro, whose `$(find)` paths start with `/` and resolve from
	// the root of files.
	xacro bool
}

func newMeshResolver(files fs.FS, urdfPath string, xacro bool) *meshResolver {
	return &meshResolver{files: files, urdfDir: path.Dir(urdfPath), xacro: xacro}
}

// findPackage is the xacro `$(find)` lookup: the package directory rooted at files with a leading `/`.
func (resolver *meshResolver) findPackage(pkg string) (string, error) {
	dir, err := resolver.packageDir(pkg)
	if err != nil {
		return "", err
	}
	return path.Join("/", dir), nil
}

// resolve returns the cleaned path of filename inside files, which must exist.
func (resolver *meshResolver) resolve(filename string) (string, error) {
	var target string
	switch {
	case strings.HasPrefix(filename, packageScheme):
		pkg, rest, ok := strings.Cut(strings.TrimPrefix(filename, packageScheme), "/")
		if !ok || rest == "" {
			return "", fmt.Errorf("mesh %q has no file after the package name", filename)
		}
		dir, err := resolver.packageDir(pkg)
		if err != nil {
			return "", fmt.Errorf("mesh %q: %w", filename, err)
		}
		target = path.Join(dir, rest)
	case strings.HasPrefix(filename, fileScheme):
		rest := strings.TrimPrefix(filename, fileScheme)
		if resolver.xacro && strings.HasPrefix(rest, "/") {
			target = strings.TrimLeft(rest, "/")
			break
		}
		if strings.HasPrefix(rest, "/") {
			return "", fmt.Errorf("mesh %q is an absolute file:// path, which cannot be resolved", filename)
		}
		target = path.Join(resolver.urdfDir, rest)
	case resolver.xacro && path.IsAbs(filename):
		target = strings.TrimLeft(filename, "/")
	case path.IsAbs(filename):
		return "", fmt.Errorf("mesh %q is an absolute path, which cannot be resolved", filename)
	default:
		target = path.Join(resolver.urdfDir, filename)
	}
	if !fs.ValidPath(target) {
		return "", fmt.Errorf("mesh %q resolves outside the uploaded files", filename)
	}
	info, err := fs.Stat(resolver.files, target)
	if err != nil || info.IsDir() {
		return "", fmt.Errorf("mesh file %q (%s) is missing", filename, target)
	}
	return target, nil
}

// packageDir finds the directory whose package.xml names pkg, else a directory named pkg.
func (resolver *meshResolver) packageDir(pkg string) (string, error) {
	if !resolver.scanned {
		if err := resolver.scan(); err != nil {
			return "", err
		}
	}
	if dir, ok := resolver.packages[pkg]; ok {
		return dir, nil
	}
	if dir, ok := resolver.dirs[pkg]; ok {
		return dir, nil
	}
	return "", fmt.Errorf("package %q has no package.xml naming it and no directory of that name", pkg)
}

func (resolver *meshResolver) scan() error {
	resolver.packages = map[string]string{}
	resolver.dirs = map[string]string{}
	resolver.scanned = true
	return fs.WalkDir(resolver.files, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if _, taken := resolver.dirs[path.Base(name)]; !taken {
				resolver.dirs[path.Base(name)] = name
			}
			return nil
		}
		if path.Base(name) != "package.xml" {
			return nil
		}
		data, err := fs.ReadFile(resolver.files, name)
		if err != nil {
			return err
		}
		var manifest struct {
			Name string `xml:"name"`
		}
		if xml.Unmarshal(data, &manifest) != nil || manifest.Name == "" {
			return nil
		}
		manifest.Name = strings.TrimSpace(manifest.Name)
		if _, taken := resolver.packages[manifest.Name]; !taken {
			resolver.packages[manifest.Name] = path.Dir(name)
		}
		return nil
	})
}
