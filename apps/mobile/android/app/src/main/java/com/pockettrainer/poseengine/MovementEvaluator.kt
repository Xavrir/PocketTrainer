package com.pockettrainer.poseengine

import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

internal data class NativeMovementEvaluation(
    val state: String,
    val repCount: Int,
    val validRepCount: Int,
    val validHoldDurationMs: Long,
    val formScore: Double?,
    val confidenceEligible: Boolean,
    val trackingStatus: String,
    val feedbackKey: String?,
    val repCompleted: Boolean,
    val completedRepScore: Double?,
)

internal data class MovementDefinitionSpec(
    val exerciseKey: String,
    val exerciseDefinitionVersion: Int,
    val scoringVersion: Int,
    val minimumPhaseDurationMs: Long,
    val targetHoldDurationMs: Long?,
    val postureScoringEnabled: Boolean,
)

internal object MovementDefinitionLoader {
    private val definitions = mapOf(
        "body_squat" to MovementDefinitionSpec("body_squat", 1, 1, 100, null, true),
        "incline_push_up" to MovementDefinitionSpec("incline_push_up", 1, 1, 100, null, false),
        "warrior_ii" to MovementDefinitionSpec("warrior_ii", 1, 1, 500, 20_000, false),
        "tree_pose" to MovementDefinitionSpec("tree_pose", 1, 1, 500, 15_000, false),
        "jumping_jack" to MovementDefinitionSpec("jumping_jack", 1, 1, 100, null, false),
    )

    fun load(exerciseKey: String): MovementDefinitionSpec? = definitions[exerciseKey]

    fun unsupported(exerciseKey: String) =
        MovementDefinitionSpec(exerciseKey, 0, 0, Long.MAX_VALUE, null, false)
}

/**
 * Native-only movement evaluation. It receives MediaPipe landmarks inside the
 * camera process and exposes only compact derived state to React Native.
 */
internal class NativeMovementEvaluator(exerciseKey: String) {
    private var definition = MovementDefinitionLoader.load(exerciseKey)
        ?: MovementDefinitionLoader.unsupported(exerciseKey)
    private var state = initialState(definition.exerciseKey)
    private var stateStartedAtMs = 0L
    private var lastTimestampMs: Long? = null
    private var lastKneeAngle: Double? = null
    private var lastElbowAngle: Double? = null
    private var repCount = 0
    private var validRepCount = 0
    private var holdDurationMs = 0L
    private var squatBottom = false
    private var squatBottomAngle = 180.0
    private var pushupBottom = false
    private var jackOpen = false
    private var feedbackKey: String? = null

    fun selectExercise(exerciseKey: String) {
        definition = MovementDefinitionLoader.load(exerciseKey)
            ?: MovementDefinitionLoader.unsupported(exerciseKey)
        reset()
    }

    fun evaluate(
        points: List<NormalizedLandmark>,
        confidence: Double,
        fullBody: Boolean,
        timestampMs: Long,
    ): NativeMovementEvaluation {
        if (MovementDefinitionLoader.load(definition.exerciseKey) == null) {
            return snapshot(
                confidenceEligible = false,
                trackingStatus = "unsupported",
                repCompleted = false,
                completedRepScore = null,
            )
        }
        val eligible = fullBody && confidence >= 0.65 && points.size >= 33
        if (!eligible) {
            val targetHoldDurationMs = definition.targetHoldDurationMs
            if (lastTimestampMs != null && timestampMs - lastTimestampMs!! >= 2_500L && targetHoldDurationMs != null) {
                reset()
            }
            return snapshot(confidenceEligible = false, trackingStatus = "paused", repCompleted = false, completedRepScore = null)
        }

        val elapsedMs = lastTimestampMs?.let { min(250L, max(0L, timestampMs - it)) } ?: 0L
        lastTimestampMs = timestampMs
        val metrics = Metrics(points, lastKneeAngle, lastElbowAngle, elapsedMs)
        lastKneeAngle = metrics.kneeAngle
        lastElbowAngle = metrics.elbowAngle
        var repCompleted = false
        var completedRepScore: Double? = null

        when (definition.exerciseKey) {
            "body_squat" -> {
                val result = evaluateSquat(metrics, timestampMs)
                repCompleted = result.first
                completedRepScore = result.second
            }
            "incline_push_up" -> {
                val result = evaluatePushup(metrics, timestampMs)
                repCompleted = result.first
                completedRepScore = result.second
            }
            "warrior_ii", "tree_pose" -> evaluateHold(metrics, timestampMs, elapsedMs)
            "jumping_jack" -> {
                val result = evaluateJumpingJack(metrics, timestampMs)
                repCompleted = result.first
                completedRepScore = result.second
            }
        }
        val currentFormScore = if (definition.postureScoringEnabled && repCompleted) completedRepScore else null
        return snapshot(
            confidenceEligible = true,
            trackingStatus = "eligible",
            repCompleted = repCompleted,
            completedRepScore = currentFormScore,
        )
    }

    private fun evaluateSquat(metrics: Metrics, timestampMs: Long): Pair<Boolean, Double?> {
        val knee = metrics.kneeAngle ?: return false to null
        val velocity = metrics.kneeVelocity
        if (knee > 159) {
            if (state == "ascending" && squatBottom && stableFor(timestampMs)) {
                val score = squatDepthScore(squatBottomAngle)
                repCount += 1
                validRepCount += 1
                squatBottom = false
                squatBottomAngle = 180.0
                state = "complete"
                stateStartedAtMs = timestampMs
                return true to score
            }
            if (state == "complete" || state == "ready") state = "standing"
        } else if (velocity < -12) {
            if (state == "standing" || state == "ready" || state == "complete") transition("descending", timestampMs)
        } else if (knee < 110 && state == "descending") {
            transition("bottom", timestampMs)
            squatBottom = true
            squatBottomAngle = min(squatBottomAngle, knee)
        } else if (squatBottom && velocity > 12) {
            transition("ascending", timestampMs)
        }
        if (state == "bottom") squatBottomAngle = min(squatBottomAngle, knee)
        return false to null
    }

    private fun evaluatePushup(metrics: Metrics, timestampMs: Long): Pair<Boolean, Double?> {
        val elbow = metrics.elbowAngle ?: return false to null
        if (elbow > 160) {
            if (state == "rising" && pushupBottom && stableFor(timestampMs)) {
                repCount += 1
                pushupBottom = false
                state = "complete"
                stateStartedAtMs = timestampMs
                return true to null
            }
            if (state == "complete" || state == "ready") state = "top"
        } else if (metrics.elbowVelocity < -10 && (state == "top" || state == "ready" || state == "complete")) {
            transition("lowering", timestampMs)
        } else if (elbow in 70.0..105.0 && state == "lowering") {
            transition("bottom", timestampMs)
            pushupBottom = true
        } else if (pushupBottom && metrics.elbowVelocity > 10) {
            transition("rising", timestampMs)
        }
        return false to null
    }

    private fun evaluateHold(metrics: Metrics, timestampMs: Long, elapsedMs: Long) {
        val aligned = if (definition.exerciseKey == "warrior_ii") {
            metrics.leftArmDeviation <= 14 && metrics.rightArmDeviation <= 14 && metrics.shoulderTilt <= 8 && metrics.kneeAnkleOffset <= 0.12
        } else {
            metrics.singleLegStability >= 0.72 && metrics.raisedKneeRotation >= 28 && abs(metrics.hipTilt) <= 12
        }
        if (!aligned) {
            feedbackKey = if (definition.exerciseKey == "warrior_ii") "warrior.kneeTrack" else "tree.fixedPoint"
            return
        }
        feedbackKey = null
        if (state == "searching") transition("aligned", timestampMs)
        if (state == "aligned" && stableFor(timestampMs)) transition("holding", timestampMs)
        if (state == "holding") holdDurationMs += elapsedMs
        val targetHoldDurationMs = definition.targetHoldDurationMs
        if (targetHoldDurationMs != null && holdDurationMs >= targetHoldDurationMs && state == "holding") {
            state = "completed"
            stateStartedAtMs = timestampMs
        }
    }

    private fun evaluateJumpingJack(metrics: Metrics, timestampMs: Long): Pair<Boolean, Double?> {
        val closed = metrics.stanceWidth <= 1.15 && metrics.leftArmDeviation >= 55 && metrics.rightArmDeviation >= 55
        val open = metrics.stanceWidth >= 1.35 && metrics.leftArmDeviation <= 28 && metrics.rightArmDeviation <= 28
        if (state == "ready" && !closed) transition("opening", timestampMs)
        else if (state == "opening" && open && stableFor(timestampMs)) {
            transition("open", timestampMs)
            jackOpen = true
        } else if (state == "open" && !open) transition("closing", timestampMs)
        else if (state == "closing" && closed && stableFor(timestampMs) && jackOpen) {
            repCount += 1
            jackOpen = false
            transition("complete", timestampMs)
            return true to null
        }
        return false to null
    }

    private fun snapshot(
        confidenceEligible: Boolean,
        trackingStatus: String,
        repCompleted: Boolean,
        completedRepScore: Double?,
    ) = NativeMovementEvaluation(
        state = state,
        repCount = repCount,
        validRepCount = validRepCount,
        validHoldDurationMs = if (definition.postureScoringEnabled) holdDurationMs else 0L,
        formScore = if (definition.postureScoringEnabled) completedRepScore else null,
        confidenceEligible = confidenceEligible,
        trackingStatus = trackingStatus,
        feedbackKey = feedbackKey,
        repCompleted = repCompleted,
        completedRepScore = if (definition.postureScoringEnabled) completedRepScore else null,
    )

    private fun transition(next: String, timestampMs: Long) {
        state = next
        stateStartedAtMs = timestampMs
    }

    private fun stableFor(timestampMs: Long): Boolean = timestampMs - stateStartedAtMs >= definition.minimumPhaseDurationMs

    private fun reset() {
        state = initialState(definition.exerciseKey)
        stateStartedAtMs = 0L
        lastTimestampMs = null
        lastKneeAngle = null
        lastElbowAngle = null
        repCount = 0
        validRepCount = 0
        holdDurationMs = 0L
        squatBottom = false
        squatBottomAngle = 180.0
        pushupBottom = false
        jackOpen = false
        feedbackKey = null
    }

    private fun squatDepthScore(kneeAngle: Double): Double = (((125.0 - kneeAngle.coerceIn(85.0, 125.0)) / 40.0) * 30.0 + 70.0).coerceIn(70.0, 100.0)
    private fun initialState(exerciseKey: String): String = when (exerciseKey) {
        "warrior_ii", "tree_pose" -> "searching"
        "body_squat", "incline_push_up", "jumping_jack" -> "ready"
        else -> "unsupported"
    }

    private class Metrics(
        points: List<NormalizedLandmark>,
        previousKnee: Double?,
        previousElbow: Double?,
        elapsedMs: Long,
    ) {
        private val p = points
        val kneeAngle: Double? = average(NativeMovementEvaluator.angle(p, 23, 25, 27), NativeMovementEvaluator.angle(p, 24, 26, 28))
        val elbowAngle: Double? = average(NativeMovementEvaluator.angle(p, 11, 13, 15), NativeMovementEvaluator.angle(p, 12, 14, 16))
        val kneeVelocity: Double = derivative(kneeAngle, previousKnee, elapsedMs)
        val elbowVelocity: Double = derivative(elbowAngle, previousElbow, elapsedMs)
        val bodyLineDeviation: Double = abs(angleFromHorizontal(11, 23) - angleFromHorizontal(23, 27))
        val leftArmDeviation: Double = angleFromHorizontal(11, 15)
        val rightArmDeviation: Double = angleFromHorizontal(12, 16)
        val shoulderTilt: Double = abs(angleFromHorizontal(11, 12))
        val hipTilt: Double = angleFromHorizontal(23, 24)
        val shoulderWidth = max(0.01, abs(p[11].x() - p[12].x()).toDouble())
        val kneeAnkleOffset: Double = abs(p[25].x() - p[27].x()).toDouble() / shoulderWidth
        val stanceWidth: Double = abs(p[27].x() - p[28].x()).toDouble() / shoulderWidth
        val raisedKneeRotation: Double = abs(atan2((p[25].x() - p[23].x()).toDouble(), (p[25].y() - p[23].y()).toDouble()) * 180.0 / Math.PI)
        val singleLegStability: Double = (1.0 - min(1.0, abs(p[27].x() - p[28].x()).toDouble() / 2.0)).coerceIn(0.0, 1.0)

        private fun angleFromHorizontal(a: Int, b: Int): Double = abs(atan2((p[b].y() - p[a].y()).toDouble(), (p[b].x() - p[a].x()).toDouble()) * 180.0 / Math.PI).let { if (it > 90) 180 - it else it }
    }

    companion object {
        private fun average(left: Double?, right: Double?): Double? = when {
            left != null && right != null -> (left + right) / 2
            left != null -> left
            else -> right
        }

        private fun derivative(current: Double?, previous: Double?, elapsedMs: Long): Double = if (current == null || previous == null || elapsedMs <= 0) 0.0 else (current - previous) / elapsedMs * 1000.0

        private fun angle(points: List<NormalizedLandmark>, a: Int, b: Int, c: Int): Double? {
            val abX = (points[a].x() - points[b].x()).toDouble()
            val abY = (points[a].y() - points[b].y()).toDouble()
            val abZ = (points[a].z() - points[b].z()).toDouble()
            val cbX = (points[c].x() - points[b].x()).toDouble()
            val cbY = (points[c].y() - points[b].y()).toDouble()
            val cbZ = (points[c].z() - points[b].z()).toDouble()
            val denominator = sqrt((abX * abX + abY * abY + abZ * abZ) * (cbX * cbX + cbY * cbY + cbZ * cbZ))
            if (denominator < 1e-6) return null
            return Math.toDegrees(acos((abX * cbX + abY * cbY + abZ * cbZ).div(denominator).coerceIn(-1.0, 1.0)))
        }
    }
}
