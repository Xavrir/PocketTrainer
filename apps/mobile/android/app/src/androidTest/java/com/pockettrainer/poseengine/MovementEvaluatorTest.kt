package com.pockettrainer.poseengine

import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin

class MovementEvaluatorTest {
    @Test
    fun onlySquatDefinitionEnablesPostureScoring() {
        assertTrue(MovementDefinitionLoader.load("body_squat")!!.postureScoringEnabled)
        for (exerciseKey in listOf("incline_push_up", "warrior_ii", "tree_pose", "jumping_jack")) {
            assertFalse(MovementDefinitionLoader.load(exerciseKey)!!.postureScoringEnabled)
        }
    }

    @Test
    fun unknownExerciseFailsClosedInsteadOfFallingBackToSquat() {
        assertNull(MovementDefinitionLoader.load("unknown_movement"))

        val evaluator = NativeMovementEvaluator("body_squat")
        evaluator.evaluate(landmarks(kneeAngle = 170.0), 0.95, true, 0)
        evaluator.selectExercise("unknown_movement")

        val evaluation = evaluator.evaluate(landmarks(kneeAngle = 100.0), 0.95, true, 1_000)

        assertEquals("unsupported", evaluation.state)
        assertEquals("unsupported", evaluation.trackingStatus)
        assertFalse(evaluation.confidenceEligible)
        assertEquals(0, evaluation.repCount)
        assertEquals(0, evaluation.validRepCount)
        assertNull(evaluation.formScore)
        assertNull(evaluation.completedRepScore)
    }

    @Test
    fun pushupRisingStateCompletesGuidedRepWithoutFormScore() {
        val evaluator = NativeMovementEvaluator("incline_push_up")

        evaluator.evaluate(landmarks(elbowAngle = 170.0), 0.95, true, 0)
        evaluator.evaluate(landmarks(elbowAngle = 140.0), 0.95, true, 200)
        evaluator.evaluate(landmarks(elbowAngle = 90.0), 0.95, true, 400)
        evaluator.evaluate(landmarks(elbowAngle = 90.0), 0.95, true, 600)
        evaluator.evaluate(landmarks(elbowAngle = 130.0), 0.95, true, 800)
        val evaluation = evaluator.evaluate(landmarks(elbowAngle = 170.0), 0.95, true, 1_000)

        assertTrue(evaluation.repCompleted)
        assertEquals(1, evaluation.repCount)
        assertEquals(0, evaluation.validRepCount)
        assertNull(evaluation.formScore)
        assertNull(evaluation.completedRepScore)
    }

    @Test
    fun onlySquatProducesAPostureScore() {
        val evaluator = NativeMovementEvaluator("body_squat")

        evaluator.evaluate(landmarks(kneeAngle = 170.0), 0.95, true, 0)
        evaluator.evaluate(landmarks(kneeAngle = 140.0), 0.95, true, 200)
        evaluator.evaluate(landmarks(kneeAngle = 100.0), 0.95, true, 400)
        evaluator.evaluate(landmarks(kneeAngle = 100.0), 0.95, true, 600)
        evaluator.evaluate(landmarks(kneeAngle = 130.0), 0.95, true, 800)
        val evaluation = evaluator.evaluate(landmarks(kneeAngle = 170.0), 0.95, true, 1_000)

        assertTrue(evaluation.repCompleted)
        assertEquals(1, evaluation.validRepCount)
        assertTrue(evaluation.formScore != null)
        assertTrue(evaluation.completedRepScore != null)
    }

    @Test
    fun lowConfidenceDoesNotAdvanceOrScore() {
        val evaluator = NativeMovementEvaluator("body_squat")

        val evaluation = evaluator.evaluate(landmarks(kneeAngle = 100.0), 0.4, true, 1_000)

        assertEquals("paused", evaluation.trackingStatus)
        assertFalse(evaluation.confidenceEligible)
        assertEquals(0, evaluation.repCount)
        assertNull(evaluation.formScore)
    }

    private fun landmarks(
        elbowAngle: Double = 170.0,
        kneeAngle: Double = 170.0,
    ): List<NormalizedLandmark> {
        val points = MutableList(33) { landmark(0.5, 0.5) }
        setJoint(points, 11, 13, 15, 0.30, elbowAngle)
        setJoint(points, 12, 14, 16, 0.70, elbowAngle)
        setJoint(points, 23, 25, 27, 0.30, kneeAngle)
        setJoint(points, 24, 26, 28, 0.70, kneeAngle)
        return points
    }

    private fun setJoint(
        points: MutableList<NormalizedLandmark>,
        proximalIndex: Int,
        jointIndex: Int,
        distalIndex: Int,
        x: Double,
        angle: Double,
    ) {
        val jointY = 0.5
        val segmentLength = 0.2
        val distalDirection = Math.toRadians(-90.0 + angle)
        points[proximalIndex] = landmark(x, jointY - segmentLength)
        points[jointIndex] = landmark(x, jointY)
        points[distalIndex] = landmark(
            x + segmentLength * cos(distalDirection),
            jointY + segmentLength * sin(distalDirection),
        )
    }

    private fun landmark(x: Double, y: Double): NormalizedLandmark =
        NormalizedLandmark.create(x.toFloat(), y.toFloat(), 0f)
}
