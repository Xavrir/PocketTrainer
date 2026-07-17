package com.pockettrainer.poseengine

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PoseOverlayViewTest {
    @Test
    fun latestFrameMailboxDropsOlderFrames() {
        val mailbox = LatestFrameMailbox<String>()

        assertNull(mailbox.offer("frame-1"))
        assertEquals("frame-1", mailbox.offer("frame-2"))
        assertEquals("frame-2", mailbox.take())
        assertNull(mailbox.take())
    }

    @Test
    fun clearingMailboxDropsPendingFrame() {
        val mailbox = LatestFrameMailbox<String>()
        mailbox.offer("frame-1")

        assertEquals("frame-1", mailbox.clear())
        assertNull(mailbox.take())
    }

    @Test
    fun clearingUnsafeLandmarksRetainsLatestCameraFrame() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val source = Bitmap.createBitmap(16, 16, Bitmap.Config.ARGB_8888).apply {
            eraseColor(Color.MAGENTA)
        }
        val rendered = Bitmap.createBitmap(16, 16, Bitmap.Config.ARGB_8888)
        lateinit var overlay: PoseOverlayView
        val drainLatestFrame = PoseOverlayView::class.java
            .getDeclaredMethod("drainLatestFrame")
            .apply { isAccessible = true }

        instrumentation.runOnMainSync {
            overlay = PoseOverlayView(instrumentation.targetContext)
            overlay.layout(0, 0, 16, 16)
            overlay.submitFrame(source, 1L)
            // The test view is intentionally unattached, so drain its posted work
            // synchronously before asserting the renderer's retained-frame state.
            drainLatestFrame.invoke(overlay)
            overlay.clearLandmarks()
            overlay.draw(Canvas(rendered))
        }

        assertEquals(Color.MAGENTA, rendered.getPixel(8, 8))
    }
}
