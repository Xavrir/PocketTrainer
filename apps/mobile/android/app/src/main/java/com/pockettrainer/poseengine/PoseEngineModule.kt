package com.pockettrainer.poseengine

/** Android boundary for the on-device camera/pose engine.
 * MediaPipe inference is intentionally isolated here; JS receives typed events only.
 */
data class PoseEngineEvent(val type: String, val payload: Map<String, Any?>)

class PoseEngineModule {
    fun start(exerciseKey: String) { require(exerciseKey.isNotBlank()) }
    fun stop() {}
}
