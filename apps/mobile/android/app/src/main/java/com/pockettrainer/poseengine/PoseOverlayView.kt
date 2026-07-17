package com.pockettrainer.poseengine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import java.util.concurrent.atomic.AtomicBoolean

internal class LatestFrameMailbox<T> {
    private var latest: T? = null

    @Synchronized
    fun offer(value: T): T? {
        val previous = latest
        latest = value
        return previous
    }

    @Synchronized
    fun take(): T? {
        val value = latest
        latest = null
        return value
    }

    @Synchronized
    fun clear(): T? {
        val value = latest
        latest = null
        return value
    }

    @Synchronized
    fun isEmpty(): Boolean = latest == null
}

internal class PoseOverlayView(context: Context) : View(context) {
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(255, 90, 107)
        strokeWidth = 8f
        strokeCap = Paint.Cap.ROUND
    }
    private val lowerLinePaint = Paint(linePaint).apply { color = Color.rgb(102, 221, 177) }
    private val pointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 249, 242) }
    private val framePaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val pendingFrames = LatestFrameMailbox<PendingFrame>()
    private val frameDispatchScheduled = AtomicBoolean(false)
    @Volatile private var minimumFrameGeneration = Long.MIN_VALUE
    private var frame: Bitmap? = null
    private var frameCanvas: Canvas? = null
    private var landmarks: List<NormalizedLandmark> = emptyList()
    private var inputWidth = 1
    private var inputHeight = 1

    /**
     * Queues only the newest analyzed frame. The incoming bitmap remains owned by
     * the analyzer/MediaPipe call and is copied into one UI-owned display bitmap;
     * neither side recycles it while asynchronous inference may still use it.
     */
    fun submitFrame(bitmap: Bitmap, generation: Long) {
        if (bitmap.isRecycled || generation <= minimumFrameGeneration) return
        pendingFrames.offer(PendingFrame(bitmap, generation))
        scheduleFrameDrain()
    }

    private fun scheduleFrameDrain() {
        if (!frameDispatchScheduled.compareAndSet(false, true)) return
        if (!post(::drainLatestFrame)) {
            frameDispatchScheduled.set(false)
        }
    }

    private fun drainLatestFrame() {
        val pending = pendingFrames.take()
        if (pending != null && pending.generation > minimumFrameGeneration) {
            copyFrameOnUi(pending.bitmap)
        }
        frameDispatchScheduled.set(false)
        if (!pendingFrames.isEmpty()) scheduleFrameDrain()
    }

    private fun copyFrameOnUi(bitmap: Bitmap) {
        if (bitmap.isRecycled) return
        if (frame == null || frame!!.width != bitmap.width || frame!!.height != bitmap.height) {
            frame = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
            frameCanvas = Canvas(frame!!)
        }
        frameCanvas?.drawBitmap(bitmap, 0f, 0f, framePaint)
        inputWidth = bitmap.width.coerceAtLeast(1)
        inputHeight = bitmap.height.coerceAtLeast(1)
        invalidate()
    }

    fun update(points: List<NormalizedLandmark>, frameWidth: Int, frameHeight: Int) {
        landmarks = points
        inputWidth = frameWidth.coerceAtLeast(1)
        inputHeight = frameHeight.coerceAtLeast(1)
        invalidate()
    }

    fun clearLandmarks() {
        landmarks = emptyList()
        invalidate()
    }

    fun clear(stoppedGeneration: Long) {
        minimumFrameGeneration = maxOf(minimumFrameGeneration, stoppedGeneration)
        pendingFrames.clear()
        frame = null
        frameCanvas = null
        landmarks = emptyList()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val scale = minOf(width / inputWidth.toFloat(), height / inputHeight.toFloat())
        val drawnWidth = inputWidth * scale
        val drawnHeight = inputHeight * scale
        val offsetX = (width - drawnWidth) / 2f
        val offsetY = (height - drawnHeight) / 2f
        frame?.let {
            canvas.drawBitmap(
                it,
                null,
                RectF(offsetX, offsetY, offsetX + drawnWidth, offsetY + drawnHeight),
                null,
            )
        }
        if (landmarks.size < 33) return
        fun x(index: Int) = offsetX + landmarks[index].x() * drawnWidth
        fun y(index: Int) = offsetY + landmarks[index].y() * drawnHeight

        CONNECTIONS.forEach { (from, to) ->
            val paint = if (from >= 23 || to >= 23) lowerLinePaint else linePaint
            canvas.drawLine(x(from), y(from), x(to), y(to), paint)
        }
        DISPLAY_POINTS.forEach { index -> canvas.drawCircle(x(index), y(index), 10f, pointPaint) }
    }

    companion object {
        private val DISPLAY_POINTS = intArrayOf(0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)
        private val CONNECTIONS = arrayOf(
            11 to 12,
            11 to 13,
            13 to 15,
            12 to 14,
            14 to 16,
            11 to 23,
            12 to 24,
            23 to 24,
            23 to 25,
            25 to 27,
            24 to 26,
            26 to 28,
        )
    }

    private data class PendingFrame(val bitmap: Bitmap, val generation: Long)
}
