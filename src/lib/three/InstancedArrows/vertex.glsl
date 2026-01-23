precision highp float;

attribute vec3 position;

attribute vec3 instanceOrigin;
attribute vec3 instanceDirection; 

#ifdef USE_COLOR_ATTRIBUTE
  attribute vec3 instanceColor;
#else
  uniform vec3 uniformColor;
#endif

uniform float shaftRadius;
uniform float headLength;
uniform float headWidth;
uniform float arrowLength;        
uniform float minimumArrowLength; 

uniform float headAtOrigin; // 0.0 = base at origin, 1.0 = head tip at origin

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

varying vec3 vColor;

void buildOrthonormalBasisFromDirection(
	in vec3 normalizedDirection,
	out vec3 basisX,
	out vec3 basisY,
	out vec3 basisZ
) {
	basisY = normalizedDirection;

	vec3 helperAxis =
		abs(basisY.z) < 0.999
			? vec3(0.0, 0.0, 1.0)
			: vec3(1.0, 0.0, 0.0);

	basisX = normalize(cross(helperAxis, basisY));
	basisZ = cross(basisY, basisX);
}

void main() {
	#ifdef USE_COLOR_ATTRIBUTE
    vColor = instanceColor;
  #else
    vColor = uniformColor;
  #endif

	float clampedArrowLength = max(arrowLength, minimumArrowLength);

	// Normalize direction, with a safe fallback if the vector is zero-length.
	vec3 normalizedDirection = instanceDirection;
	float directionMagnitude = length(normalizedDirection);
	normalizedDirection =
		(directionMagnitude > 0.0)
			? (normalizedDirection / directionMagnitude)
			: vec3(0.0, 1.0, 0.0);

	vec3 basisX, basisY, basisZ;
	buildOrthonormalBasisFromDirection(normalizedDirection, basisX, basisY, basisZ);

  vec3 scaledInstanceOrigin = instanceOrigin * 0.001;
  vec3 effectiveOrigin = scaledInstanceOrigin;

	// Shift the arrow so its head tip lands at the provided origin.
	if (headAtOrigin > 0.5) {
		effectiveOrigin -= basisY * clampedArrowLength;
	}

	float computedHeadLength = min(headLength, clampedArrowLength);
	float computedShaftLength = max(clampedArrowLength - computedHeadLength, 0.0);

	vec3 localPosition = position.xyz;

	#if defined(IS_HEAD)
		// Scale unit cone to head dimensions.
		localPosition.xz *= headWidth;
		localPosition.y  *= computedHeadLength;

		// Head starts where shaft ends.
		vec3 headOffsetAlongDirection = basisY * computedShaftLength;

		vec3 worldPosition =
			effectiveOrigin +
			headOffsetAlongDirection +
			(basisX * localPosition.x + basisY * localPosition.y + basisZ * localPosition.z);
	#else
		// Scale unit shaft to shaft dimensions.
		localPosition.xz *= shaftRadius;
		localPosition.y  *= computedShaftLength;

		if (computedShaftLength <= 0.0) {
			localPosition *= 0.0;
		}

		vec3 worldPosition =
			effectiveOrigin +
			(basisX * localPosition.x + basisY * localPosition.y + basisZ * localPosition.z);
	#endif

	gl_Position = projectionMatrix * (modelViewMatrix * vec4(worldPosition, 1.0));
}
