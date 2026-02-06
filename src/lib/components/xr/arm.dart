import 'dart:async';
import 'dart:math' as math;

import 'package:arkit_plugin/arkit_plugin.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:vector_math/vector_math_64.dart' as vector_math;
import 'package:viam_sdk/viam_sdk.dart';

import '../../utils/spatialmath/spatial_math.dart';

class ARKitArmViewModel extends ChangeNotifier {
  ARKitArmViewModel({required this.arm, this.gripper});

  final Arm arm;
  final Gripper? gripper;

  ARKitController? arkitController;

  // Scale factor: unitless ratio of robotic arm movement to phone movement
  // Example: 1.0 means robotic arm moves 100% of phone movement
  double positionScaleFactor = 1.0; // default
  static const double _rotationDeadbandRad = 0.25;

  bool isMovingArm = false;
  bool isARKitInitialized = false;
  String? lastError;
  bool _isDisposed = false;

  double? dragStartPos;
  String? lastDirection;
  static const double _verticalDragThreshold = 100.0;

  vector_math.Vector3 _currentPhonePositionARKit = vector_math.Vector3.zero();
  vector_math.Matrix3 _currentPhoneRotationARKit =
      vector_math.Matrix3.identity();

  // Store the starting states from the phone and arm
  Pose? _referenceArmPose;
  final List<Pose> _referenceArmPoseStack = [];
  vector_math.Vector3? _referencePhonePositionARKit;
  vector_math.Matrix3? _referencePhoneRotationARKit;
  vector_math.Quaternion? _referencePhoneRotationQuatViam;

  bool isReferenceSet = false;

  Pose? targetArmPose; // where we are trying to go
  Pose? currentArmPose; // where we actually are

  // Frame transformation from ARKit to Viam
  // Viam Frame: Right-handed Z is up (X+ Forward, Y+ Left, Z+ Up)
  // ARKit Frame: Right-handed Y is up (X+ Right, Y+ Up, Z+ Back (towards user))
  // Full mapping: ARKit(X,Y,Z) → Viam(-Y,X,Z) rotated
  late final vector_math.Quaternion _arkitToViamFrameTransform = () {
    // 1: Rotate -90° around Z-axis (swaps X and Y)
    final rotZ = vector_math.Quaternion.axisAngle(
      vector_math.Vector3(0.0, 0.0, 1.0),
      -math.pi / 2,
    );
    // 2: Rotate 90° around X-axis (makes Y → Z)
    final rotX = vector_math.Quaternion.axisAngle(
      vector_math.Vector3(1.0, 0.0, 0.0),
      math.pi / 2,
    );
    // Quaternion multiplication is performed right to left
    // Apply rotX first, then rotZ
    return rotZ * rotX;
  }();

  late final vector_math.Quaternion inverseARKitToViamFrameTransform =
      vector_math.Quaternion(
        -_arkitToViamFrameTransform.x,
        -_arkitToViamFrameTransform.y,
        -_arkitToViamFrameTransform.z,
        _arkitToViamFrameTransform.w,
      );

  @override
  void dispose() {
    _isDisposed = true;

    try {
      if (arkitController != null) {
        arkitController!.updateAtTime = null;
        arkitController!.dispose();
      }
    } catch (e) {
      debugPrint('Error disposing ARKit controller: $e');
    }
    super.dispose();
  }

  void onARKitViewCreated(ARKitController controller) {
    try {
      arkitController = controller;

      isARKitInitialized = true;
      lastError = null;
      notifyListeners();

      // Called every frame (~60fps) - get camera transform and update position
      arkitController!.updateAtTime = (time) {
        if (_isDisposed || !isReferenceSet || arkitController == null) return;

        arkitController!
            .pointOfViewTransform()
            .then((transform) async {
              if (_isDisposed || transform == null) return;
              try {
                // Extract position from transform matrix (4th column)
                _currentPhonePositionARKit = vector_math.Vector3(
                  transform[12],
                  transform[13],
                  transform[14],
                );

                // Extract orientation from transform matrix (upper-left 3x3 rotation matrix)
                _currentPhoneRotationARKit = vector_math.Matrix3(
                  transform[0],
                  transform[1],
                  transform[2],
                  transform[4],
                  transform[5],
                  transform[6],
                  transform[8],
                  transform[9],
                  transform[10],
                );

                final newPose = _createPoseFromARKit();
                if (newPose == null) return;
                await _executePendingPose(newPose);
              } catch (e) {
                lastError = 'Error processing camera transform: $e';
                notifyListeners();
              }
            })
            .catchError((e) {
              lastError = 'Error getting camera transform: $e';
              notifyListeners();
            });
      };
    } catch (e) {
      lastError = 'Failed to initialize ARKit: $e';
      isARKitInitialized = false;
      notifyListeners();
    }
  }

  /// Create a pose based on ARKit camera position and orientation
  Pose? _createPoseFromARKit() {
    if (_referenceArmPose == null ||
        _referencePhonePositionARKit == null ||
        _referencePhoneRotationARKit == null) {
      return null;
    }
    // Calculate new position in Viam frame
    final positionDelta =
        _currentPhonePositionARKit - _referencePhonePositionARKit!;
    // positionDelta is in meters (ARKit units), Pose coordinates are in mm
    // Multiply by 1000 to convert meters to mm
    final positionScaleInMeters = positionScaleFactor * 1000;
    final newX =
        _referenceArmPose!.x + (-positionDelta.z * positionScaleInMeters);
    final newY =
        _referenceArmPose!.y + ((-positionDelta.x) * positionScaleInMeters);
    final newZ =
        _referenceArmPose!.z + (positionDelta.y * positionScaleInMeters);

    // Step 1: Calculate rotation delta between current and reference phone rotation.
    // To find the difference between two quaternions, we can multiply the current quaternion by the inverse of the other quaternion
    // 1a: Convert current phone rotation to quaternion
    final currentRotationQuaternionARKit = vector_math.Quaternion.fromRotation(
      _currentPhoneRotationARKit,
    );
    // 1b: Convert current rotation from ARKit frame to Viam frame
    final currentRotationQuaternionViamPhone =
        _arkitToViamFrameTransform *
        currentRotationQuaternionARKit *
        inverseARKitToViamFrameTransform;

    // 1c: Grab reference phone rotation quaternion
    final referenceRotationQuaternionViamPhone =
        _referencePhoneRotationQuatViam!;
    // 1d: Calculate inverse of reference phone rotation
    final inverseReferencePhoneQuaternionViam = vector_math.Quaternion(
      -referenceRotationQuaternionViamPhone.x,
      -referenceRotationQuaternionViamPhone.y,
      -referenceRotationQuaternionViamPhone.z,
      referenceRotationQuaternionViamPhone.w,
    );
    // 1e: Delta = Current * Inverse(Reference)
    final rotationDeltaViam =
        currentRotationQuaternionViamPhone *
        inverseReferencePhoneQuaternionViam;

    // Step 2: Convert the rotation delta quaternion to an angle in radians
    double rotationAngle = 2 * math.acos(rotationDeltaViam.w.clamp(-1.0, 1.0));

    // Step 3: Apply deadband filter, skip small rotations to reduce jitter
    final OrientationVector newRotationOV;
    if (rotationAngle < _rotationDeadbandRad) {
      newRotationOV = OrientationVector(
        _referenceArmPose!.theta,
        _referenceArmPose!.oX,
        _referenceArmPose!.oY,
        _referenceArmPose!.oZ,
      );
    } else {
      // Step 4: Apply delta to reference arm orientation
      // 4a: Convert orientation values from reference pose to orientation vector
      // 4b: Convert orientation vector to quaternion
      final referenceRotationOrientationVector = OrientationVector(
        _referenceArmPose!.theta,
        _referenceArmPose!.oX,
        _referenceArmPose!.oY,
        _referenceArmPose!.oZ,
      );
      final referenceRotationQuaternion = referenceRotationOrientationVector
          .toQuaternion();
      // Convert spatial_math Quaternion to vector_math Quaternion for multiplication
      final referenceRotationQuaternionViam = vector_math.Quaternion(
        referenceRotationQuaternion.imag,
        referenceRotationQuaternion.jmag,
        referenceRotationQuaternion.kmag,
        referenceRotationQuaternion.real,
      );
      // 4c: Apply delta to reference arm orientation
      final newRotationQuaternionViam =
          rotationDeltaViam * referenceRotationQuaternionViam;

      // Step 5: Convert quaternions back to orientation vector to be used for the new pose
      // 5a: Convert the new rotation quaternion to a spatial math quaternion
      // 5b: Convert the spatial math quaternion to an orientation vector
      final newRotationQuaternionSpatialMath = Quaternion(
        newRotationQuaternionViam.w,
        newRotationQuaternionViam.x,
        newRotationQuaternionViam.y,
        newRotationQuaternionViam.z,
      );
      newRotationOV = newRotationQuaternionSpatialMath
          .toOrientationVectorRadians();
    }

    // Step 6: Create the new pose with the new rotation and position values
    final newPose = Pose(
      x: newX,
      y: newY,
      z: newZ,
      theta: newRotationOV.theta,
      oX: newRotationOV.ox,
      oY: newRotationOV.oy,
      oZ: newRotationOV.oz,
    );

    // Skip if pose hasn't changed significantly
    if (currentArmPose != null) {
      final lastPose = currentArmPose!;
      if ((newPose.x - lastPose.x).abs() < 1.0 &&
          (newPose.y - lastPose.y).abs() < 1.0 &&
          (newPose.z - lastPose.z).abs() < 1.0) {
        return null;
      }
    }
    return newPose;
  }

  Future<void> _executePendingPose(Pose pose) async {
    if (isMovingArm) return;
    targetArmPose = pose;
    notifyListeners();
    try {
      isMovingArm = true;

      await arm
          .moveToPosition(pose)
          .timeout(
            const Duration(seconds: 10),
            onTimeout: () async {
              await arm.stop();
              lastError = 'Move to position timed out';
              notifyListeners();
              return;
            },
          );
      currentArmPose = pose;
      lastError = null;
      notifyListeners();
    } catch (e) {
      lastError = e.toString();
      notifyListeners();
    } finally {
      isMovingArm = false;
    }
  }

  /// Return the arm to the most recently stored reference pose.
  Future<void> returnToLastReference() async {
    if (_referenceArmPoseStack.isEmpty) {
      lastError = 'Reference pose is not set';
      notifyListeners();
      return;
    }

    final poseToGo = _referenceArmPoseStack.removeLast();
    try {
      await arm.moveToPosition(poseToGo);
      currentArmPose = poseToGo;
      lastError = null;
      notifyListeners();
    } catch (e) {
      lastError = 'Failed to move to reference: $e';
      notifyListeners();
    }
  }

  /// Set reference point
  Future<void> setReference() async {
    if (arkitController == null || !isARKitInitialized) {
      lastError = 'ARKit is not initialized yet';
      notifyListeners();
      return;
    }

    try {
      // Get the current arm position and store it as the reference
      final currentPoseSetRef = await arm.endPosition();
      // Get current ARKit camera position
      final transform = await arkitController!.pointOfViewTransform();

      if (transform == null) {
        lastError = 'Failed to get ARKit camera transform';
        notifyListeners();
        return;
      }

      // Extract position (4th column of transform matrix)
      final positionVector = vector_math.Vector3(
        transform[12], // X
        transform[13], // Y
        transform[14], // Z
      );

      // Extract orientation (upper-left 3x3 submatrix from transform matrix)
      final rotationMatrix = vector_math.Matrix3(
        transform[0],
        transform[1],
        transform[2],
        transform[4],
        transform[5],
        transform[6],
        transform[8],
        transform[9],
        transform[10],
      );

      // Convert phone orientation from ARKit frame to quaternion
      final referenceRotationQuaternionARKit =
          vector_math.Quaternion.fromRotation(rotationMatrix);
      // Convert that to Viam frame, so we save the reference phone rotation quaternion in Viam frame
      final referenceRotationQuaternionViamPhone =
          _arkitToViamFrameTransform *
          referenceRotationQuaternionARKit *
          inverseARKitToViamFrameTransform;

      _referenceArmPose = currentPoseSetRef;
      _referenceArmPoseStack.add(currentPoseSetRef);
      _referencePhonePositionARKit = positionVector;
      _referencePhoneRotationARKit = rotationMatrix;
      _referencePhoneRotationQuatViam = referenceRotationQuaternionViamPhone;

      targetArmPose = currentPoseSetRef;
      currentArmPose = currentPoseSetRef;
      isReferenceSet = true;
      lastError = null;
      notifyListeners();
    } catch (e) {
      lastError = "Failed to set reference: ${e.toString()}";
      notifyListeners();
    }
  }

  void updatePositionScaleFactor(double value) {
    positionScaleFactor = value;
    notifyListeners();
  }

  void releaseControlButton() async {
    HapticFeedback.heavyImpact();
    try {
      await arm.stop();
    } catch (e) {
      debugPrint('Failed to stop arm on release of button: $e');
    } finally {
      isReferenceSet = false;
      notifyListeners();
    }
  }

  Future<void> openGripper(Gripper gripper) async {
    try {
      await gripper.open();
    } catch (e) {
      lastError = 'Failed to open gripper: $e';
      notifyListeners();
    }
  }

  Future<void> grabGripper(Gripper gripper) async {
    try {
      await gripper.grab();
    } catch (e) {
      lastError = 'Failed to grab gripper: $e';
      notifyListeners();
    }
  }

  Future<void> stopGripper(Gripper gripper) async {
    try {
      await gripper.stop();
    } catch (e) {
      lastError = 'Failed to stop gripper: $e';
      notifyListeners();
    }
  }

  void onLongPressDown(LongPressDownDetails details) {
    HapticFeedback.heavyImpact();
    setReference();
    if (gripper != null) {
      dragStartPos = details.globalPosition.dy;
      lastDirection = null;
    }
  }

  Future<void> onLongPressUp() async {
    releaseControlButton();
    if (gripper != null) {
      await stopGripper(gripper!);
      dragStartPos = null;
      lastDirection = null;
    }
  }

  Future<void> onLongPressCancel() async {
    releaseControlButton();
    if (gripper != null) {
      await stopGripper(gripper!);
      dragStartPos = null;
      lastDirection = null;
    }
  }

  void onLongPressMoveUpdate(LongPressMoveUpdateDetails details) {
    if (gripper == null || dragStartPos == null) return;

    final verticalDelta = details.globalPosition.dy - dragStartPos!;
    final distanceMoved = verticalDelta.abs();

    if (distanceMoved >= _verticalDragThreshold) {
      // determine direction: up (negative) or down (positive)
      final currentDirection = verticalDelta < 0 ? 'up' : 'down';

      // Only trigger if direction changed
      if (lastDirection != currentDirection) {
        lastDirection = currentDirection;

        // Trigger appropriate gripper action
        if (currentDirection == 'up') {
          grabGripper(gripper!);
        } else {
          openGripper(gripper!);
        }
      }
    }
  }

  String get statusText {
    if (!isReferenceSet) {
      return 'Ready';
    } else if (isMovingArm) {
      return 'Moving...';
    } else {
      return 'Active';
    }
  }

  String get controlButtonText {
    return isReferenceSet ? "CONTROLLING - RELEASE TO STOP" : "HOLD TO CONTROL";
  }
}


import 'dart:math' as math;
// The spatial math code is part of the arkit arm controller experiment.

part 'common.dart';
part 'euler_angles.dart';
part 'orientation_vector.dart';
part 'quaternion.dart';

part of 'spatial_math.dart';

class Quaternion {
  double real; // W
  double imag; // X
  double jmag; // Y
  double kmag; // Z

  Quaternion(this.real, this.imag, this.jmag, this.kmag);

  Quaternion.identity() : real = 1.0, imag = 0.0, jmag = 0.0, kmag = 0.0;

  Quaternion.zero() : real = 0.0, imag = 0.0, jmag = 0.0, kmag = 0.0;

  OrientationVector toOrientationVectorRadians() {
    return quatToOV(this);
  }

  Quaternion conj() {
    return Quaternion(real, -imag, -jmag, -kmag);
  }

  // add quaternions by using this multiplication function
  Quaternion mul(Quaternion other) {
    return Quaternion(
      real * other.real - imag * other.imag - jmag * other.jmag - kmag * other.kmag,
      real * other.imag + imag * other.real + jmag * other.kmag - kmag * other.jmag,
      real * other.jmag - imag * other.kmag + jmag * other.real + kmag * other.imag,
      real * other.kmag + imag * other.jmag - jmag * other.imag + kmag * other.real,
    );
  }
}

OrientationVector quatToOV(Quaternion q) {
  final xAxis = Quaternion(0, -1, 0, 0);
  final zAxis = Quaternion(0, 0, 0, 1);
  final ov = OrientationVector.zero();
  // Get the transform of our +X and +Z points
  final newX = q.mul(xAxis).mul(q.conj());
  final newZ = q.mul(zAxis).mul(q.conj());
  ov.ox = newZ.imag;
  ov.oy = newZ.jmag;
  ov.oz = newZ.kmag;

  if (1 - newZ.kmag.abs() > orientationVectorPoleRadius) {
    final v1 = Vec3(newZ.imag, newZ.jmag, newZ.kmag);
    final v2 = Vec3(newX.imag, newX.jmag, newX.kmag);

    final norm1 = v1.cross(v2);
    final norm2 = v1.cross(Vec3(zAxis.imag, zAxis.jmag, zAxis.kmag));

    double cosTheta = norm1.dot(norm2) / (norm1.len() * norm2.len());
    if (cosTheta > 1) cosTheta = 1;
    if (cosTheta < -1) cosTheta = -1;

    final theta = math.acos(cosTheta);
    if (theta > orientationVectorPoleRadius) {
      final aa = R4AA(-theta, ov.ox, ov.oy, ov.oz);
      final q2 = aa.toQuat();
      final testZ = q2.mul(zAxis).mul(q2.conj());
      final norm3 = v1.cross(Vec3(testZ.imag, testZ.jmag, testZ.kmag));
      final cosTest = norm1.dot(norm3) / (norm1.len() * norm3.len());
      if (1 - cosTest < defaultAngleEpsilon * defaultAngleEpsilon) {
        ov.theta = -theta;
      } else {
        ov.theta = theta;
      }
    } else {
      ov.theta = 0;
    }
  } else {
    // Special case for when we point directly along the Z axis
    ov.theta = -math.atan2(newX.jmag, -newX.imag);
    if (newZ.kmag < 0) {
      ov.theta = -math.atan2(newX.jmag, newX.imag);
    }
  }

  if (ov.theta == -0.0) {
    ov.theta = 0.0;
  }

  return ov;
}

bool quaternionAlmostEqual(Quaternion a, Quaternion b, double tol) {
  return float64AlmostEqual(a.imag, b.imag, tol) &&
      float64AlmostEqual(a.jmag, b.jmag, tol) &&
      float64AlmostEqual(a.kmag, b.kmag, tol) &&
      float64AlmostEqual(a.real, b.real, tol);
}


part of 'spatial_math.dart';

class OrientationVector {
  double theta;
  double ox;
  double oy;
  double oz;

  OrientationVector(this.theta, this.ox, this.oy, this.oz);

  OrientationVector.zero() : theta = 0.0, ox = 0.0, oy = 0.0, oz = 1.0;

  double _computeNormal() {
    return math.sqrt(ox * ox + oy * oy + oz * oz);
  }

  String? isValid() {
    if (_computeNormal() == 0.0) {
      return "OrientationVector has a normal of 0, probably X, Y, and Z are all 0";
    }
    return null;
  }

  void normalize() {
    final norm = _computeNormal();
    if (norm == 0.0) {
      oz = 1;
      return;
    }
    ox /= norm;
    oy /= norm;
    oz /= norm;
  }

  Quaternion toQuaternion() {
    normalize();

    final lat = math.acos(oz);

    double lon = 0.0;
    final th = theta;

    if (1 - oz.abs() > defaultAngleEpsilon) {
      lon = math.atan2(oy, ox);
    }

    final q1 = MGLQuat.anglesToQuat(lon, lat, th);
    return Quaternion(q1.w, q1.x(), q1.y(), q1.z());
  }
}

part of 'spatial_math.dart';

class EulerAngles {
  double roll;
  double pitch;
  double yaw;

  EulerAngles(this.roll, this.pitch, this.yaw);

  EulerAngles.zero() : roll = 0.0, pitch = 0.0, yaw = 0.0;

  Quaternion toQuaternion() {
    final cy = math.cos(yaw * 0.5);
    final sy = math.sin(yaw * 0.5);
    final cp = math.cos(pitch * 0.5);
    final sp = math.sin(pitch * 0.5);
    final cr = math.cos(roll * 0.5);
    final sr = math.sin(roll * 0.5);

    final q = Quaternion.zero();
    q.real = cr * cp * cy + sr * sp * sy;
    q.imag = sr * cp * cy - cr * sp * sy;
    q.jmag = cr * sp * cy + sr * cp * sy;
    q.kmag = cr * cp * sy - sr * sp * cy;

    return q;
  }
}


part of 'spatial_math.dart';

/// How close OZ must be to +/-1 in order to use pole math for computing theta.
const double orientationVectorPoleRadius = 0.0001;

/// A small epsilon value for float comparisons, assumed from context.
const double defaultAngleEpsilon = 1e-9;

/// Stub for utils.RadToDeg
double radToDeg(double rad) {
  return rad * (180.0 / math.pi);
}

/// Stub for utils.DegToRad
double degToRad(double deg) {
  return deg * (math.pi / 180.0);
}

/// Stub for utils.Float64AlmostEqual
bool float64AlmostEqual(double a, double b, double tol) {
  return (a - b).abs() <= tol;
}

/// Stub for r3.Vector
class R3Vector {
  double x, y, z;
  R3Vector(this.x, this.y, this.z);
}

/// Stub for mgl64.Vec3
class Vec3 {
  double x, y, z;
  Vec3(this.x, this.y, this.z);

  double dot(Vec3 other) {
    return x * other.x + y * other.y + z * other.z;
  }

  Vec3 cross(Vec3 other) {
    return Vec3(
      y * other.z - z * other.y,
      z * other.x - x * other.z,
      x * other.y - y * other.x,
    );
  }

  double len() {
    return math.sqrt(x * x + y * y + z * z);
  }
}

/// Stub for mgl64.Quat
class MGLQuat {
  double w;
  Vec3 v;

  MGLQuat(this.w, this.v);

  MGLQuat normalize() {
    final l = math.sqrt(w * w + v.x * v.x + v.y * v.y + v.z * v.z);
    if (l == 0) return MGLQuat(1, Vec3(0, 0, 0));
    return MGLQuat(w / l, Vec3(v.x / l, v.y / l, v.z / l));
  }

  MGLQuat scale(double s) {
    return MGLQuat(w * s, Vec3(v.x * s, v.y * s, v.z * s));
  }

  double x() => v.x;
  double y() => v.y;
  double z() => v.z;

  /// Stub for mgl64.QuatSlerp
  static MGLQuat slerp(MGLQuat q1, MGLQuat q2, double t) {
    // A simplified slerp implementation
    double cosHalfTheta = q1.w * q2.w + q1.v.dot(q2.v);

    if (cosHalfTheta.abs() >= 1.0) {
      return q1;
    }

    double halfTheta = math.acos(cosHalfTheta);
    double sinHalfTheta = math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

    if (sinHalfTheta.abs() < 0.001) {
      return MGLQuat(
        q1.w * 0.5 + q2.w * 0.5,
        Vec3(
          q1.v.x * 0.5 + q2.v.x * 0.5,
          q1.v.y * 0.5 + q2.v.y * 0.5,
          q1.v.z * 0.5 + q2.v.z * 0.5,
        ),
      );
    }

    double ratioA = math.sin((1 - t) * halfTheta) / sinHalfTheta;
    double ratioB = math.sin(t * halfTheta) / sinHalfTheta;

    return MGLQuat(
      (q1.w * ratioA + q2.w * ratioB),
      Vec3(
        (q1.v.x * ratioA + q2.v.x * ratioB),
        (q1.v.y * ratioA + q2.v.y * ratioB),
        (q1.v.z * ratioA + q2.v.z * ratioB),
      ),
    );
  }

  /// Stub for mgl64.QuatNlerp
  static MGLQuat nlerp(MGLQuat q1, MGLQuat q2, double t) {
    // Simplified nlerp
    final q = MGLQuat(
      (1 - t) * q1.w + t * q2.w,
      Vec3(
        (1 - t) * q1.v.x + t * q2.v.x,
        (1 - t) * q1.v.y + t * q2.v.y,
        (1 - t) * q1.v.z + t * q2.v.z,
      ),
    );
    return q.normalize();
  }

  /// Stub for mgl64.AnglesToQuat(lon, lat, theta, mgl64.ZYZ)
  static MGLQuat anglesToQuat(double z1, double y, double z2) {
    // ZYZ Euler to Quaternion
    final c1 = math.cos(z1 / 2);
    final s1 = math.sin(z1 / 2);
    final c2 = math.cos(y / 2);
    final s2 = math.sin(y / 2);
    final c3 = math.cos(z2 / 2);
    final s3 = math.sin(z2 / 2);

    return MGLQuat(
      c1 * c2 * c3 - s1 * c2 * s3, // w
      Vec3(
        c1 * s2 * c3 - s1 * s2 * s3, // x
        c1 * s2 * s3 + s1 * s2 * c3, // y
        s1 * c2 * c3 + c1 * c2 * s3, // z
      ),
    );
  }
}

/// Stub for R4AA (Axis-Angle)
class R4AA {
  double theta, rx, ry, rz;
  R4AA(this.theta, this.rx, this.ry, this.rz);

  /// Stub for R4AA.ToQuat()
  Quaternion toQuat() {
    final halfAngle = theta / 2.0;
    final s = math.sin(halfAngle);
    return Quaternion(
      math.cos(halfAngle),
      rx * s,
      ry * s,
      rz * s,
    );
  }
}

/// Stub for RotationMatrix
class RotationMatrix {
  List<double> mat; // Expects a list of 9 doubles
  RotationMatrix(this.mat);
}

/// Stub for NewZeroOrientation()
Quaternion newZeroOrientation() {
  return Quaternion(1, 0, 0, 0); // Identity quaternion
}
