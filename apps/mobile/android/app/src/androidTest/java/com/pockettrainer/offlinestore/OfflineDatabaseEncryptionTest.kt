package com.pockettrainer.offlinestore

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.MessageDigest
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OfflineDatabaseEncryptionTest {
  @Test
  fun encryptedQueueSurvivesReopenAndRejectsCameraData() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    val ownerId = "test-${UUID.randomUUID()}"
    val sessionId = UUID.randomUUID().toString()
    val marker = "PRIVATE_OFFLINE_MARKER_${UUID.randomUUID()}"
    val keyManager = OfflineKeyManager(context)

    val first = OfflineDatabase(context, keyManager)
    first.initialize(ownerId)
    first.saveBootstrap("{\"catalog\":{\"marker\":\"$marker\"},\"progress\":{\"xp\":0}}", 1)
    first.enqueueWorkout(
      sessionId,
      "{\"createIdempotencyKey\":\"$sessionId:create\"}",
      "{\"repetitionCount\":8,\"formScore\":91}",
    )
    assertEquals(1, first.status().pendingCount)

    val second = OfflineDatabase(context, keyManager)
    second.initialize(ownerId)
    assertEquals(1, second.listPendingWorkouts(10).size)
    assertEquals(1, second.status().pendingCount)
    assertEquals("{\"marker\":\"$marker\"}", second.loadCatalog())
    assertEquals("{\"results\":[]}", second.loadWorkoutResultState(sessionId))

    val ownerHash = MessageDigest.getInstance("SHA-256")
      .digest(ownerId.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
      .take(32)
    val bytes = context.getDatabasePath("pockettrainer-$ownerHash.db").readBytes()
    assertFalse(bytes.copyOfRange(0, 16).contentEquals("SQLite format 3\u0000".toByteArray()))
    assertFalse(String(bytes, Charsets.ISO_8859_1).contains(marker))

    assertThrows(IllegalArgumentException::class.java) {
      second.enqueueWorkout(
        UUID.randomUUID().toString(),
        "{\"frames\":[\"raw\"]}",
        "{\"repetitionCount\":1}",
      )
    }

    second.markWorkoutSynced(sessionId, "{\"xpAwarded\":40}")
    assertEquals(0, second.status().pendingCount)
    assertTrue(second.status().lastSyncedAt != null)
    assertEquals("{\"xpAwarded\":40}", second.getSyncedWorkout(sessionId))
  }
}
