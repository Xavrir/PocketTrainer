package com.pockettrainer.poseengine

import java.lang.ref.WeakReference

internal interface PoseEngineTarget {
    fun start(exerciseKey: String)
    fun stop()
}

internal class PoseEngineController {
    private var current = WeakReference<PoseEngineTarget>(null)
    private var requestedExercise: String? = null
    private var paused = false

    fun attach(view: PoseEngineTarget) {
        current = WeakReference(view)
        requestedExercise?.let { exerciseKey ->
            if (paused) view.stop() else view.start(exerciseKey)
        }
    }

    fun detach(view: PoseEngineTarget) {
        if (current.get() === view) current.clear()
    }

    fun start(exerciseKey: String) {
        requestedExercise = exerciseKey
        paused = false
        current.get()?.start(exerciseKey)
    }

    fun selectExercise(exerciseKey: String) {
        requestedExercise = exerciseKey
        if (!paused) current.get()?.start(exerciseKey)
    }

    fun pause() {
        paused = true
        current.get()?.stop()
    }

    fun resume() {
        paused = false
        requestedExercise?.let { current.get()?.start(it) }
    }

    fun stop() {
        paused = true
        current.get()?.stop()
    }
}

internal object PoseEngineRegistry {
    private val controller = PoseEngineController()

    fun attach(view: PoseEngineTarget) = controller.attach(view)
    fun detach(view: PoseEngineTarget) = controller.detach(view)
    fun start(exerciseKey: String) = controller.start(exerciseKey)
    fun selectExercise(exerciseKey: String) = controller.selectExercise(exerciseKey)
    fun pause() = controller.pause()
    fun resume() = controller.resume()
    fun stop() = controller.stop()
}
