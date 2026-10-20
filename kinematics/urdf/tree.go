package urdf

import (
	"fmt"
	"sort"
	"strings"

	"go.viam.com/rdk/spatialmath"
)

const (
	jointRevolute   = "revolute"
	jointContinuous = "continuous"
	jointPrismatic  = "prismatic"
	jointFixed      = "fixed"
)

// linkTree is the URDF link and joint graph, with every link's frame at zero joint inputs.
type linkTree struct {
	links       map[string]*urdfLink
	joints      map[string]*urdfJoint
	parentJoint map[string]*urdfJoint
	hasChildren map[string]bool
	order       []string
	root        string
	world       map[string]spatialmath.Pose
}

func buildLinkTree(robot *urdfRobot) (*linkTree, error) {
	tree := &linkTree{
		links:       map[string]*urdfLink{},
		joints:      map[string]*urdfJoint{},
		parentJoint: map[string]*urdfJoint{},
		hasChildren: map[string]bool{},
		world:       map[string]spatialmath.Pose{},
	}
	for i := range robot.Links {
		link := &robot.Links[i]
		if _, duplicate := tree.links[link.Name]; duplicate {
			return nil, fmt.Errorf("link %q is defined twice", link.Name)
		}
		tree.links[link.Name] = link
		tree.order = append(tree.order, link.Name)
	}
	for i := range robot.Joints {
		joint := &robot.Joints[i]
		if err := tree.addJoint(joint); err != nil {
			return nil, err
		}
	}
	if err := tree.findRoot(robot); err != nil {
		return nil, err
	}
	return tree, tree.placeLinks(robot)
}

func (tree *linkTree) addJoint(joint *urdfJoint) error {
	switch joint.Type {
	case jointRevolute, jointContinuous, jointPrismatic, jointFixed:
	case "floating", "planar":
		return fmt.Errorf("joint %q is %s, which Viam models cannot represent", joint.Name, joint.Type)
	default:
		return fmt.Errorf("joint %q has unknown type %q", joint.Name, joint.Type)
	}
	if _, duplicate := tree.joints[joint.Name]; duplicate {
		return fmt.Errorf("joint %q is defined twice", joint.Name)
	}
	for _, name := range []string{joint.Parent.Link, joint.Child.Link} {
		if tree.links[name] == nil {
			return fmt.Errorf("joint %q references unknown link %q", joint.Name, name)
		}
	}
	if other := tree.parentJoint[joint.Child.Link]; other != nil {
		return fmt.Errorf("link %q is the child of both joint %q and joint %q", joint.Child.Link, other.Name, joint.Name)
	}
	tree.joints[joint.Name] = joint
	tree.parentJoint[joint.Child.Link] = joint
	tree.hasChildren[joint.Parent.Link] = true
	return nil
}

func (tree *linkTree) findRoot(robot *urdfRobot) error {
	var roots []string
	for _, link := range robot.Links {
		if tree.parentJoint[link.Name] == nil {
			roots = append(roots, link.Name)
		}
	}
	switch len(roots) {
	case 1:
		tree.root = roots[0]
		return nil
	case 0:
		return fmt.Errorf("no root link: every link is a joint's child")
	}
	return fmt.Errorf("expected exactly one root link, found %d: %s", len(roots), strings.Join(roots, ", "))
}

// placeLinks composes joint origins down from the root, which sits at the assembly origin.
func (tree *linkTree) placeLinks(robot *urdfRobot) error {
	tree.world[tree.root] = spatialmath.NewZeroPose()
	for pending := true; pending; {
		pending = false
		for i := range robot.Joints {
			joint := &robot.Joints[i]
			parent, placedParent := tree.world[joint.Parent.Link]
			if _, placedChild := tree.world[joint.Child.Link]; !placedParent || placedChild {
				continue
			}
			origin, err := joint.Origin.pose()
			if err != nil {
				return fmt.Errorf("joint %q: %w", joint.Name, err)
			}
			tree.world[joint.Child.Link] = spatialmath.Compose(parent, origin)
			pending = true
		}
	}
	if len(tree.world) == len(tree.links) {
		return nil
	}
	var unreachable []string
	for name := range tree.links {
		if _, placed := tree.world[name]; !placed {
			unreachable = append(unreachable, name)
		}
	}
	sort.Strings(unreachable)
	return fmt.Errorf("links not connected to root %q: %s", tree.root, strings.Join(unreachable, ", "))
}

// driver returns the nearest non-fixed joint at or above link, or empty for the base.
func (tree *linkTree) driver(link string) string {
	for {
		joint := tree.parentJoint[link]
		if joint == nil {
			return ""
		}
		if joint.Type != jointFixed {
			return joint.Name
		}
		link = joint.Parent.Link
	}
}
