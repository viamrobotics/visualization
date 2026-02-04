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
