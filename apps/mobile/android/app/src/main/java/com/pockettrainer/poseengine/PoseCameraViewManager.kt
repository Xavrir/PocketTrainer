package com.pockettrainer.poseengine

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

internal class PoseCameraViewManager : SimpleViewManager<PoseCameraView>() {
    override fun getName() = "PoseCameraView"

    override fun createViewInstance(context: ThemedReactContext) = PoseCameraView(context)

    @ReactProp(name = "exerciseKey")
    fun setExerciseKey(view: PoseCameraView, exerciseKey: String?) {
        exerciseKey?.takeIf { it.isNotBlank() }?.let(PoseEngineRegistry::selectExercise)
    }

    @ReactProp(name = "paused", defaultBoolean = false)
    fun setPaused(view: PoseCameraView, paused: Boolean) {
        if (paused) PoseEngineRegistry.pause() else PoseEngineRegistry.resume()
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
        MapBuilder.of("topPoseEvent", MapBuilder.of("registrationName", "onPoseEvent"))

    override fun onDropViewInstance(view: PoseCameraView) {
        view.stop()
        super.onDropViewInstance(view)
    }
}
