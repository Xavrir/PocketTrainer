package com.pockettrainer.poseengine

import java.lang.ref.WeakReference

internal object PoseEngineRegistry {
    private var current = WeakReference<PoseCameraView>(null)
    private var requestedExercise: String? = null
    private var paused = false

    fun attach(view: PoseCameraView) {
        current = WeakReference(view)
        requestedExercise?.let { exerciseKey ->
            if (paused) view.stop() else view.start(exerciseKey)
        }
    }

    fun detach(view: PoseCameraView) {
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
