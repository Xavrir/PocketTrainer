package com.pockettrainer.poseengine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark

internal class PoseOverlayView(context: Context) : View(context) {
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(255, 90, 107)
        strokeWidth = 8f
        strokeCap = Paint.Cap.ROUND
    }
    private val lowerLinePaint = Paint(linePaint).apply { color = Color.rgb(102, 221, 177) }
    private val pointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 249, 242) }
    private var frame: Bitmap? = null
    private var landmarks: List<NormalizedLandmark> = emptyList()
    private var inputWidth = 1
    private var inputHeight = 1

    fun update(points: List<NormalizedLandmark>, frameWidth: Int, frameHeight: Int) {
        landmarks = points
        inputWidth = frameWidth.coerceAtLeast(1)
        inputHeight = frameHeight.coerceAtLeast(1)
        invalidate()
    }

    fun updateFrame(bitmap: Bitmap) {
        frame = bitmap
        inputWidth = bitmap.width.coerceAtLeast(1)
        inputHeight = bitmap.height.coerceAtLeast(1)
        invalidate()
    }

    fun clear() {
        frame = null
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
}
