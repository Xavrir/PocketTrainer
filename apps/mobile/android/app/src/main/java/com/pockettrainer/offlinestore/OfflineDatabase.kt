package com.pockettrainer.offlinestore

import android.content.Context
import android.database.Cursor
import java.security.MessageDigest
import net.zetetic.database.sqlcipher.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject

internal data class PendingWorkout(
  val clientSessionId: String,
  val payloadJson: String,
  val summaryJson: String,
  val attemptCount: Int,
  val nextAttemptAt: Long,
)

internal data class OfflineStatus(
  val pendingCount: Int,
  val failedCount: Int,
  val lastSyncedAt: Long?,
)

internal class OfflineDatabase(
  private val context: Context,
  private val keyManager: OfflineKeyManager,
) {
  private var database: SQLiteDatabase? = null
  private var ownerId: String? = null

  @Synchronized
  fun initialize(nextOwnerId: String) {
    require(OWNER_PATTERN.matches(nextOwnerId)) { "Invalid offline store owner." }
    if (ownerId == nextOwnerId && database?.isOpen == true) return
    database?.close()
    database = null

    System.loadLibrary("sqlcipher")
    val ownerHash = MessageDigest.getInstance("SHA-256")
      .digest(nextOwnerId.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
      .take(32)
    val databaseFile = context.getDatabasePath("pockettrainer-$ownerHash.db")
    databaseFile.parentFile?.mkdirs()
    val passphrase = keyManager.getOrCreateDatabasePassphrase()
    val opened = SQLiteDatabase.openOrCreateDatabase(
      databaseFile.absolutePath,
      passphrase,
      null,
      null,
      null,
    )
    opened.enableWriteAheadLogging()
    opened.execSQL("PRAGMA foreign_keys = ON")
    migrate(opened)
    database = opened
    ownerId = nextOwnerId
  }

  @Synchronized
  fun saveBootstrap(payloadJson: String, revision: Int) {
    validateSafeJson(payloadJson)
    val bootstrap = JSONObject(payloadJson)
    bootstrap.optJSONObject("catalog")?.let { saveProjection("catalog", it.toString(), revision) }
    bootstrap.optJSONObject("currentPlan")?.let { saveProjection("plan", it.toString(), revision) }
    bootstrap.optJSONObject("progress")?.let { saveProjection("progress", it.toString(), revision) }
    writable().execSQL(
      """
      INSERT INTO bootstrap_cache(singleton_id, payload_json, revision, updated_at)
      VALUES(1, ?, ?, ?)
      ON CONFLICT(singleton_id) DO UPDATE SET
        payload_json = excluded.payload_json,
        revision = excluded.revision,
        updated_at = excluded.updated_at
      """.trimIndent(),
      arrayOf<Any?>(payloadJson, revision, System.currentTimeMillis()),
    )
  }

  @Synchronized
  fun loadBootstrap(): String? =
    writable().rawQuery(
      "SELECT payload_json FROM bootstrap_cache WHERE singleton_id = 1",
      emptyArray(),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

  @Synchronized
  fun loadCatalog(): String? = loadProjection("catalog")

  @Synchronized
  fun loadPlan(): String? = loadProjection("plan")

  @Synchronized
  fun loadProgress(): String? = loadProjection("progress")

  @Synchronized
  fun loadWorkoutResultState(clientSessionId: String): String? =
    writable().rawQuery(
      "SELECT results_json FROM workout_results WHERE client_session_id = ?",
      arrayOf(clientSessionId),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

  @Synchronized
  fun getSyncedWorkout(clientSessionId: String): String? =
    writable().rawQuery(
      "SELECT authoritative_json FROM workout_sessions WHERE client_session_id = ? AND status = 'synced'",
      arrayOf(clientSessionId),
    ).use { cursor ->
      if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
    }

  @Synchronized
  fun enqueueWorkout(clientSessionId: String, payloadJson: String, summaryJson: String) {
    require(CLIENT_ID_PATTERN.matches(clientSessionId)) { "Invalid client session id." }
    validateSafeJson(payloadJson)
    validateSafeJson(summaryJson)
    val db = writable()
    db.beginTransaction()
    try {
      val existing = db.rawQuery(
        "SELECT payload_json, summary_json FROM workout_sessions WHERE client_session_id = ?",
        arrayOf(clientSessionId),
      ).use { cursor ->
        if (!cursor.moveToFirst()) null else cursor.getString(0) to cursor.getString(1)
      }
      if (existing != null && existing != (payloadJson to summaryJson)) {
        throw IllegalStateException("Client session id was reused with different workout data.")
      }
      val now = System.currentTimeMillis()
      db.execSQL(
        """
        INSERT OR IGNORE INTO workout_sessions(
          client_session_id, payload_json, summary_json, status, created_at, updated_at
        ) VALUES(?, ?, ?, 'pending', ?, ?)
        """.trimIndent(),
        arrayOf<Any?>(clientSessionId, payloadJson, summaryJson, now, now),
      )
      db.execSQL(
        """
        INSERT OR IGNORE INTO sync_queue(
          client_session_id, idempotency_key, status, attempt_count,
          next_attempt_at, created_at, updated_at
        ) VALUES(?, ?, 'pending', 0, 0, ?, ?)
        """.trimIndent(),
        arrayOf<Any?>(clientSessionId, "$clientSessionId:complete", now, now),
      )
      val payload = JSONObject(payloadJson)
      val results = payload.optJSONObject("results") ?: payload.optJSONArray("results")
      if (results != null) {
        db.execSQL(
          """
          INSERT INTO workout_results(client_session_id, results_json, updated_at)
          VALUES(?, ?, ?)
          ON CONFLICT(client_session_id) DO UPDATE SET
            results_json = excluded.results_json,
            updated_at = excluded.updated_at
          """.trimIndent(),
          arrayOf<Any?>(clientSessionId, results.toString(), now),
        )
      }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  @Synchronized
  fun listPendingWorkouts(limit: Int): List<PendingWorkout> {
    val safeLimit = limit.coerceIn(1, 50)
    return writable().rawQuery(
      """
      SELECT w.client_session_id, w.payload_json, w.summary_json,
             q.attempt_count, q.next_attempt_at
      FROM sync_queue q
      JOIN workout_sessions w ON w.client_session_id = q.client_session_id
      WHERE q.status IN ('pending', 'failed') AND q.next_attempt_at <= ?
      ORDER BY q.created_at ASC
      LIMIT $safeLimit
      """.trimIndent(),
      arrayOf(System.currentTimeMillis().toString()),
    ).use(::readPending)
  }

  @Synchronized
  fun markWorkoutSynced(clientSessionId: String, authoritativeJson: String) {
    validateSafeJson(authoritativeJson)
    val db = writable()
    val now = System.currentTimeMillis()
    db.beginTransaction()
    try {
      db.execSQL(
        """
        UPDATE workout_sessions
        SET status = 'synced', authoritative_json = ?, updated_at = ?
        WHERE client_session_id = ?
        """.trimIndent(),
        arrayOf<Any?>(authoritativeJson, now, clientSessionId),
      )
      db.execSQL(
        """
        UPDATE sync_queue
        SET status = 'synced', last_error = NULL, updated_at = ?
        WHERE client_session_id = ?
        """.trimIndent(),
        arrayOf<Any?>(now, clientSessionId),
      )
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  @Synchronized
  fun recordAttemptFailure(clientSessionId: String, errorCode: String, nextAttemptAt: Long) {
    val safeError = errorCode.take(120)
    writable().execSQL(
      """
      UPDATE sync_queue
      SET status = 'failed', attempt_count = attempt_count + 1,
          last_error = ?, next_attempt_at = ?, updated_at = ?
      WHERE client_session_id = ?
      """.trimIndent(),
      arrayOf<Any?>(safeError, nextAttemptAt, System.currentTimeMillis(), clientSessionId),
    )
  }

  @Synchronized
  fun status(): OfflineStatus {
    val db = writable()
    val counts = db.rawQuery(
      """
      SELECT
        SUM(CASE WHEN status IN ('pending', 'failed') THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)
      FROM sync_queue
      """.trimIndent(),
      emptyArray(),
    ).use { cursor ->
      cursor.moveToFirst()
      (if (cursor.isNull(0)) 0 else cursor.getInt(0)) to
        (if (cursor.isNull(1)) 0 else cursor.getInt(1))
    }
    val lastSyncedAt = db.rawQuery(
      "SELECT MAX(updated_at) FROM sync_queue WHERE status = 'synced'",
      emptyArray(),
    ).use { cursor ->
      cursor.moveToFirst()
      if (cursor.isNull(0)) null else cursor.getLong(0)
    }
    return OfflineStatus(counts.first, counts.second, lastSyncedAt)
  }

  private fun writable(): SQLiteDatabase =
    database?.takeIf { it.isOpen }
      ?: throw IllegalStateException("Offline store is not initialized for an authenticated user.")

  private fun migrate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS bootstrap_cache(
        singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
        payload_json TEXT NOT NULL,
        revision INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS workout_sessions(
        client_session_id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        authoritative_json TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'synced')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS sync_queue(
        client_session_id TEXT PRIMARY KEY REFERENCES workout_sessions(client_session_id),
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('pending', 'failed', 'synced')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE INDEX IF NOT EXISTS sync_queue_pending_idx
      ON sync_queue(status, next_attempt_at, created_at)
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS offline_projections(
        projection_key TEXT PRIMARY KEY CHECK(projection_key IN ('catalog', 'plan', 'progress')),
        payload_json TEXT NOT NULL,
        revision INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS workout_results(
        client_session_id TEXT PRIMARY KEY REFERENCES workout_sessions(client_session_id),
        results_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL("PRAGMA user_version = 2")
  }

  private fun saveProjection(key: String, payloadJson: String, revision: Int) {
    validateSafeJson(payloadJson)
    writable().execSQL(
      """
      INSERT INTO offline_projections(projection_key, payload_json, revision, updated_at)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(projection_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        revision = excluded.revision,
        updated_at = excluded.updated_at
      """.trimIndent(),
      arrayOf<Any?>(key, payloadJson, revision, System.currentTimeMillis()),
    )
  }

  private fun loadProjection(key: String): String? =
    writable().rawQuery(
      "SELECT payload_json FROM offline_projections WHERE projection_key = ?",
      arrayOf(key),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

  private fun readPending(cursor: Cursor): List<PendingWorkout> {
    val items = mutableListOf<PendingWorkout>()
    while (cursor.moveToNext()) {
      items += PendingWorkout(
        clientSessionId = cursor.getString(0),
        payloadJson = cursor.getString(1),
        summaryJson = cursor.getString(2),
        attemptCount = cursor.getInt(3),
        nextAttemptAt = cursor.getLong(4),
      )
    }
    return items
  }

  private fun validateSafeJson(value: String) {
    require(value.toByteArray(Charsets.UTF_8).size <= MAX_JSON_BYTES) {
      "Offline payload exceeds the local safety limit."
    }
    val parsed = value.trim().let {
      when {
        it.startsWith("{") -> JSONObject(it)
        it.startsWith("[") -> JSONArray(it)
        else -> throw IllegalArgumentException("Offline payload must be JSON.")
      }
    }
    rejectSensitiveKeys(parsed)
  }

  private fun rejectSensitiveKeys(value: Any?) {
    when (value) {
      is JSONObject -> {
        val keys = value.keys()
        while (keys.hasNext()) {
          val key = keys.next()
          require(key.lowercase() !in FORBIDDEN_KEYS) {
            "Raw camera or landmark data cannot be stored offline."
          }
          rejectSensitiveKeys(value.opt(key))
        }
      }
      is JSONArray -> for (index in 0 until value.length()) rejectSensitiveKeys(value.opt(index))
    }
  }

  private companion object {
    val OWNER_PATTERN = Regex("^[A-Za-z0-9:_-]{1,128}$")
    val CLIENT_ID_PATTERN = Regex("^[A-Za-z0-9:_-]{1,128}$")
    val FORBIDDEN_KEYS = setOf(
      "frame",
      "frames",
      "cameraframe",
      "landmark",
      "landmarks",
      "landmarkstream",
      "imagedata",
      "videodata",
    )
    const val MAX_JSON_BYTES = 512 * 1024
  }
}
