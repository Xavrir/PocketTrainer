package com.pockettrainer.poseengine

import org.junit.Assert.assertEquals
import org.junit.Test

class PoseEngineControllerTest {
    @Test
    fun pauseStopsProcessingAndResumeUsesLatestExercise() {
        val controller = PoseEngineController()
        val target = RecordingTarget()
        controller.attach(target)

        controller.start("body_squat")
        controller.pause()
        controller.selectExercise("tree_pose")

        assertEquals(listOf("body_squat"), target.startedExercises)
        assertEquals(1, target.stopCount)

        controller.resume()

        assertEquals(listOf("body_squat", "tree_pose"), target.startedExercises)
        assertEquals(1, target.stopCount)
    }

    private class RecordingTarget : PoseEngineTarget {
        val startedExercises = mutableListOf<String>()
        var stopCount = 0

        override fun start(exerciseKey: String) {
            startedExercises += exerciseKey
        }

        override fun stop() {
            stopCount += 1
        }
    }
}
