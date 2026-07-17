package com.pockettrainer.poseengine

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
}
