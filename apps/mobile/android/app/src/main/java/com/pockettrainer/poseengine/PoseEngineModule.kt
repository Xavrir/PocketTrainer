package com.pockettrainer.poseengine

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Small control surface for the native engine. Camera frames and landmarks never cross it. */
class PoseEngineModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "PoseEngine"

    @ReactMethod
    fun start(exerciseKey: String, promise: Promise) {
        if (exerciseKey.isBlank()) {
            promise.reject("INVALID_EXERCISE", "exerciseKey must not be blank")
            return
        }
        PoseEngineRegistry.start(exerciseKey)
        promise.resolve(null)
    }

    @ReactMethod
    fun pause(promise: Promise) {
        PoseEngineRegistry.pause()
        promise.resolve(null)
    }

    @ReactMethod
    fun resume(promise: Promise) {
        PoseEngineRegistry.resume()
        promise.resolve(null)
    }

    @ReactMethod
    fun stop(promise: Promise) {
        PoseEngineRegistry.stop()
        promise.resolve(null)
    }

    @ReactMethod
    fun isAvailable(promise: Promise) = promise.resolve(true)
}
