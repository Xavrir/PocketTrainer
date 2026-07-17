package com.pockettrainer.poseengine

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong
import java.util.UUID
import java.time.Instant
import kotlin.math.acos
import kotlin.math.sqrt

internal class PoseCameraView(private val reactContext: ReactContext) : FrameLayout(reactContext) {
    private val overlay = PoseOverlayView(reactContext).apply {
        layoutParams = LayoutParams(MATCH_PARENT, MATCH_PARENT)
    }
    private val analysisExecutor = Executors.newSingleThreadExecutor()
    private val analysisStateLock = Any()
    private val analysisGeneration = AtomicLong(0L)
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var startingGeneration: Long? = null
    @Volatile private var requestedRunning = false
    private var landmarker: PoseLandmarker? = null
    private var exerciseKey = ""
    private var lifecycleRetryCount = 0
    private var movementEvaluator = NativeMovementEvaluator("body_squat")
    private var sessionId = UUID.randomUUID().toString()
    private var eventSequence = 0L
    private var lastSubmissionMs = 0L
    private var repCount = 0
    private var reachedBottom = false
    private var bottomKneeAngle = 180.0

    init {
        setBackgroundColor(android.graphics.Color.rgb(23, 20, 20))
        addView(overlay)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        PoseEngineRegistry.attach(this)
    }

    override fun onDetachedFromWindow() {
        stop()
        PoseEngineRegistry.detach(this)
        super.onDetachedFromWindow()
    }

    fun start(newExerciseKey: String) {
        synchronized(analysisStateLock) {
            if (newExerciseKey != exerciseKey) {
                repCount = 0
                reachedBottom = false
                bottomKneeAngle = 180.0
                movementEvaluator.selectExercise(newExerciseKey)
            }
            exerciseKey = newExerciseKey
            if (!requestedRunning) {
                sessionId = UUID.randomUUID().toString()
                eventSequence = 0L
            }
            requestedRunning = true
        }
        if (!isAttachedToWindow || cameraProvider != null) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            emit("recoverable_error") {
                putString("code", "CAMERA_PERMISSION_REQUIRED")
                putString("message", "Izin kamera diperlukan untuk coaching postur.")
            }
            return
        }
        val activity = reactContext.currentActivity
        if (activity !is LifecycleOwner) {
            if (lifecycleRetryCount < MAX_LIFECYCLE_RETRIES) {
                lifecycleRetryCount += 1
                postDelayed({
                    if (requestedRunning && cameraProvider == null) start(newExerciseKey)
                }, LIFECYCLE_RETRY_DELAY_MS)
            } else {
                emit("recoverable_error") {
                    putString("code", "LIFECYCLE_UNAVAILABLE")
                    putString("message", "Kamera belum siap. Coba buka sesi lagi.")
                }
            }
            return
        }
        lifecycleRetryCount = 0
        val generation = synchronized(analysisStateLock) {
            if (!requestedRunning || startingGeneration != null) return
            analysisGeneration.incrementAndGet().also { startingGeneration = it }
        }
        if (!setupLandmarker(generation)) {
            finishStarting(generation)
            return
        }
        val providerFuture = ProcessCameraProvider.getInstance(context)
        providerFuture.addListener({
            if (!isAttachedToWindow || !isGenerationRunning(generation)) {
                finishStarting(generation)
                return@addListener
            }
            try {
                val provider = providerFuture.get()
                val analysisUseCase = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { it.setAnalyzer(analysisExecutor) { frame -> analyze(frame, generation) } }
                provider.unbindAll()
                provider.bindToLifecycle(
                    activity,
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    analysisUseCase,
                )
                cameraProvider = provider
                imageAnalysis = analysisUseCase
                finishStarting(generation)
            } catch (error: RuntimeException) {
                finishStarting(generation)
                emit("recoverable_error", generation) {
                    putString("code", "CAMERA_BIND_ERROR")
                    putString("message", error.message ?: "Kamera tidak dapat dimulai.")
                }
            }
        }, ContextCompat.getMainExecutor(context))
        emit("calibration_status", generation) { putString("status", "body_outside_frame") }
    }

    fun stop() {
        val stoppedGeneration: Long
        val landmarkerToClose: PoseLandmarker?
        synchronized(analysisStateLock) {
            requestedRunning = false
            lifecycleRetryCount = 0
            stoppedGeneration = analysisGeneration.incrementAndGet()
            landmarkerToClose = landmarker
            landmarker = null
            startingGeneration = null
        }
        imageAnalysis?.clearAnalyzer()
        imageAnalysis = null
        cameraProvider?.unbindAll()
        cameraProvider = null
        closeLandmarkerOnAnalysisExecutor(landmarkerToClose)
        post {
            if (!requestedRunning && analysisGeneration.get() == stoppedGeneration) {
                overlay.clear(stoppedGeneration)
            }
        }
    }

    private fun setupLandmarker(generation: Long): Boolean {
        val options = PoseLandmarker.PoseLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL).build())
            .setRunningMode(RunningMode.LIVE_STREAM)
            .setNumPoses(2)
            .setMinPoseDetectionConfidence(0.55f)
            .setMinPosePresenceConfidence(0.55f)
            .setMinTrackingConfidence(0.55f)
            .setResultListener { result, input -> onResult(generation, result, input) }
            .setErrorListener { error ->
                emit("recoverable_error", generation) {
                    putString("code", "POSE_INFERENCE_ERROR")
                    putString("message", error.message ?: "Analisis postur terhenti.")
                }
            }
            .build()
        val newLandmarker = PoseLandmarker.createFromOptions(context, options)
        val landmarkerToClose = synchronized(analysisStateLock) {
            if (!isGenerationRunning(generation)) {
                newLandmarker
            } else {
                val previousLandmarker = landmarker
                landmarker = newLandmarker
                previousLandmarker
            }
        }
        closeLandmarkerOnAnalysisExecutor(landmarkerToClose)
        return landmarkerToClose !== newLandmarker
    }

    private fun analyze(image: ImageProxy, generation: Long) {
        val now = SystemClock.uptimeMillis()
        try {
            synchronized(analysisStateLock) {
                if (!isGenerationRunning(generation)) return
                if (now - lastSubmissionMs < FRAME_INTERVAL_MS) return
                lastSubmissionMs = now

                val source = image.toBitmap()
                val matrix = Matrix().apply {
                    postRotate(image.imageInfo.rotationDegrees.toFloat())
                    postScale(-1f, 1f)
                }
                val rotated = Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
                if (!isGenerationRunning(generation)) return
                overlay.submitFrame(rotated, generation)
                landmarker?.detectAsync(BitmapImageBuilder(rotated).build(), now)
            }
        } catch (error: RuntimeException) {
            emit("recoverable_error", generation) {
                putString("code", "FRAME_CONVERSION_ERROR")
                putString("message", error.message ?: "Frame kamera tidak dapat dianalisis.")
            }
        } finally {
            image.close()
        }
    }

    private fun onResult(
        generation: Long,
        result: PoseLandmarkerResult,
        input: com.google.mediapipe.framework.image.MPImage,
    ) {
        synchronized(analysisStateLock) {
            if (!isGenerationRunning(generation)) return
            val poses = result.landmarks()
            if (poses.size != 1) {
                // Keep the latest camera frame visible while removing stale pose graphics.
                postIfRunning(generation) { overlay.clearLandmarks() }
                emitTracking(
                    0.0,
                    false,
                    if (poses.size > 1) "multiple_people" else "not_visible",
                    generation,
                )
                return
            }
            val points = poses.first()
            val required = REQUIRED_LANDMARKS.map { points[it] }
            val confidence = required.map { it.visibility().orElse(0f).toDouble() }.average()
            val fullBody = confidence >= 0.6 && required.all { it.x() in 0.02f..0.98f && it.y() in 0.02f..0.98f }
            val evaluation = movementEvaluator.evaluate(points, confidence, fullBody, SystemClock.uptimeMillis())
            if (evaluation.repCompleted) {
                emit("rep_complete", generation) {
                    putInt("rep", evaluation.repCount)
                    evaluation.completedRepScore?.let { putDouble("formScore", it) } ?: putNull("formScore")
                    putDouble("confidence", confidence)
                }
            }
            postIfRunning(generation) {
                if (fullBody) {
                    overlay.update(points, input.width, input.height)
                } else {
                    // A low-confidence pose is not safe to render as guidance. Keep the
                    // camera frame stable and remove only the stale skeleton.
                    overlay.clearLandmarks()
                }
            }
            emitTracking(confidence, fullBody, if (fullBody) null else "landmark_confidence", generation)
            emit("calibration_status", generation) {
                putString("status", if (fullBody) "ready" else "body_outside_frame")
                putLong("stableDurationMs", if (fullBody) 800 else 0)
            }
            emit("movement_update", generation) {
                putString("phase", evaluation.state)
                putString("state", evaluation.state)
                putInt("repCount", evaluation.repCount)
                putInt("validRepCount", evaluation.validRepCount)
                putLong("validHoldDurationMs", evaluation.validHoldDurationMs)
                evaluation.formScore?.let { putDouble("formScore", it) } ?: putNull("formScore")
            }
            emit("feedback_changed", generation) {
                putString("feedbackKey", evaluation.feedbackKey)
                putString("severity", if (fullBody) "info" else "caution")
                putString("message", if (fullBody) feedbackFor(evaluation.state) else "Mundur perlahan hingga kepala, tangan, dan kedua kaki terlihat (jarak awal 2–3 m).")
            }
        }
    }

    private fun feedbackFor(phase: String): String = when (exerciseKey) {
        "body_squat" -> if (phase == "bottom") "Dorong lantai dan naik dengan kontrol." else "Jaga lutut mengikuti arah jari kaki."
        "incline_push_up" -> "Latihan terpandu: hitung sendiri repetisi yang selesai dengan nyaman. Skor form belum tersedia."
        "warrior_ii" -> "Latihan terpandu: tahan posisi dengan nyaman. Skor form belum tersedia."
        "tree_pose" -> "Latihan terpandu: tatap satu titik dan turun bila kehilangan keseimbangan. Skor form belum tersedia."
        else -> "Latihan terpandu: bergerak perlahan dengan kontrol. Skor form belum tersedia."
    }

    /** Scores only the squat depth observed at the bottom of a confidence-eligible rep. */
    private fun squatDepthScore(kneeAngle: Double): Double =
        (((125.0 - kneeAngle.coerceIn(85.0, 125.0)) / 40.0) * 30.0 + 70.0)
            .coerceIn(70.0, 100.0)

    private fun emitTracking(confidence: Double, visible: Boolean, reason: String?, generation: Long) {
        emit("tracking_status", generation) {
            putString("status", if (visible) "eligible" else "paused")
            putDouble("confidence", confidence)
            putBoolean("visible", visible)
            reason?.let { putString("reason", it) }
        }
    }

    private fun angle(points: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>, a: Int, b: Int, c: Int): Double {
        val abX = points[a].x() - points[b].x()
        val abY = points[a].y() - points[b].y()
        val cbX = points[c].x() - points[b].x()
        val cbY = points[c].y() - points[b].y()
        val denominator = sqrt((abX * abX + abY * abY) * (cbX * cbX + cbY * cbY)).toDouble()
        if (denominator < 1e-6) return 180.0
        val cosine = ((abX * cbX + abY * cbY) / denominator).coerceIn(-1.0, 1.0)
        return Math.toDegrees(acos(cosine))
    }

    private fun closeLandmarkerOnAnalysisExecutor(target: PoseLandmarker?) {
        if (target == null) return
        analysisExecutor.execute { target.close() }
    }

    private fun isGenerationRunning(generation: Long): Boolean =
        requestedRunning && analysisGeneration.get() == generation

    private fun finishStarting(generation: Long) {
        synchronized(analysisStateLock) {
            if (startingGeneration == generation) startingGeneration = null
        }
    }

    private inline fun postIfRunning(generation: Long, crossinline block: () -> Unit) {
        post {
            if (isGenerationRunning(generation)) block()
        }
    }

    private inline fun emit(
        type: String,
        generation: Long? = null,
        block: com.facebook.react.bridge.WritableMap.() -> Unit,
    ) {
        val payload = Arguments.createMap().apply {
            putString("type", type)
            putString("sessionId", sessionId)
            eventSequence += 1
            putDouble("sequence", eventSequence.toDouble())
            putString("occurredAt", Instant.now().toString())
            if (type == "recoverable_error") putBoolean("recoverable", true)
            block()
        }
        post {
            if (generation != null && !isGenerationRunning(generation)) return@post
            UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
                PoseViewEvent(UIManagerHelper.getSurfaceId(this), id, payload),
            )
        }
    }

    private class PoseViewEvent(
        surfaceId: Int,
        viewTag: Int,
        private val payload: WritableMap,
    ) : Event<PoseViewEvent>(surfaceId, viewTag) {
        override fun getEventName() = "topPoseEvent"
        override fun getEventData() = payload
        override fun canCoalesce() = false
    }

    companion object {
        private const val MODEL = "pose_landmarker_lite.task"
        private const val FRAME_INTERVAL_MS = 66L
        private const val LIFECYCLE_RETRY_DELAY_MS = 100L
        private const val MAX_LIFECYCLE_RETRIES = 20
        private const val SCORED_EXERCISE = "body_squat"
        private val REQUIRED_LANDMARKS = intArrayOf(0, 11, 12, 23, 24, 25, 26, 27, 28)
    }
}
