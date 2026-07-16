package com.pockettrainer.offlinestore

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.Executors
import java.util.UUID

class OfflineStoreModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val database = OfflineDatabase(context, OfflineKeyManager(context))
  private val executor = Executors.newSingleThreadExecutor()
  private val connectivityManager =
    context.getSystemService(ConnectivityManager::class.java)
  private var listenerCount = 0
  private var networkCallback: ConnectivityManager.NetworkCallback? = null

  override fun getName() = "PocketTrainerOfflineStore"

  @ReactMethod
  fun createId(promise: Promise) = promise.resolve(UUID.randomUUID().toString())

  @ReactMethod
  fun initialize(ownerId: String, promise: Promise) = runAsync(promise) {
    database.initialize(ownerId)
    Arguments.createMap().apply {
      putBoolean("encrypted", true)
      putInt("schemaVersion", 1)
    }
  }

  @ReactMethod
  fun saveBootstrap(payloadJson: String, revision: Double, promise: Promise) = runAsync(promise) {
    database.saveBootstrap(payloadJson, revision.toInt())
    null
  }

  @ReactMethod
  fun loadBootstrap(promise: Promise) = runAsync(promise) { database.loadBootstrap() }

  @ReactMethod
  fun enqueueWorkout(
    clientSessionId: String,
    payloadJson: String,
    summaryJson: String,
    promise: Promise,
  ) = runAsync(promise) {
    database.enqueueWorkout(clientSessionId, payloadJson, summaryJson)
    null
  }

  @ReactMethod
  fun listPendingWorkouts(limit: Double, promise: Promise) = runAsync(promise) {
    Arguments.createArray().apply {
      database.listPendingWorkouts(limit.toInt()).forEach { workout ->
        pushMap(Arguments.createMap().apply {
          putString("clientSessionId", workout.clientSessionId)
          putString("payloadJson", workout.payloadJson)
          putString("summaryJson", workout.summaryJson)
          putInt("attemptCount", workout.attemptCount)
          putDouble("nextAttemptAt", workout.nextAttemptAt.toDouble())
        })
      }
    }
  }

  @ReactMethod
  fun markWorkoutSynced(
    clientSessionId: String,
    authoritativeJson: String,
    promise: Promise,
  ) = runAsync(promise) {
    database.markWorkoutSynced(clientSessionId, authoritativeJson)
    null
  }

  @ReactMethod
  fun recordAttemptFailure(
    clientSessionId: String,
    errorCode: String,
    nextAttemptAt: Double,
    promise: Promise,
  ) = runAsync(promise) {
    database.recordAttemptFailure(clientSessionId, errorCode, nextAttemptAt.toLong())
    null
  }

  @ReactMethod
  fun getStatus(promise: Promise) = runAsync(promise) {
    val status = database.status()
    Arguments.createMap().apply {
      putInt("pendingCount", status.pendingCount)
      putInt("failedCount", status.failedCount)
      if (status.lastSyncedAt == null) putNull("lastSyncedAt")
      else putDouble("lastSyncedAt", status.lastSyncedAt.toDouble())
    }
  }

  @ReactMethod
  fun getSyncedWorkout(clientSessionId: String, promise: Promise) = runAsync(promise) {
    database.getSyncedWorkout(clientSessionId)
  }

  @ReactMethod
  fun loadCatalog(promise: Promise) = runAsync(promise) { database.loadCatalog() }

  @ReactMethod
  fun loadPlan(promise: Promise) = runAsync(promise) { database.loadPlan() }

  @ReactMethod
  fun loadProgress(promise: Promise) = runAsync(promise) { database.loadProgress() }

  @ReactMethod
  fun loadWorkoutResultState(clientSessionId: String, promise: Promise) = runAsync(promise) {
    database.loadWorkoutResultState(clientSessionId)
  }

  @ReactMethod
  @Synchronized
  fun addListener(eventName: String) {
    if (eventName != NETWORK_AVAILABLE_EVENT) return
    listenerCount += 1
    if (listenerCount == 1) registerNetworkCallback()
  }

  @ReactMethod
  @Synchronized
  fun removeListeners(count: Double) {
    listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
    if (listenerCount == 0) unregisterNetworkCallback()
  }

  override fun invalidate() {
    unregisterNetworkCallback()
    executor.shutdown()
    super.invalidate()
  }

  private fun registerNetworkCallback() {
    if (networkCallback != null) return
    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
        if (
          capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
          capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        ) {
          emitNetworkAvailable()
        }
      }
    }
    networkCallback = callback
    connectivityManager.registerDefaultNetworkCallback(callback)
  }

  private fun unregisterNetworkCallback() {
    val callback = networkCallback ?: return
    runCatching { connectivityManager.unregisterNetworkCallback(callback) }
    networkCallback = null
  }

  private fun emitNetworkAvailable() {
    if (!context.hasActiveReactInstance()) return
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(NETWORK_AVAILABLE_EVENT, null)
  }

  private fun runAsync(promise: Promise, block: () -> Any?) {
    executor.execute {
      try {
        promise.resolve(block())
      } catch (error: Throwable) {
        promise.reject("OFFLINE_STORE_ERROR", error.message, error)
      }
    }
  }

  private companion object {
    const val NETWORK_AVAILABLE_EVENT = "PocketTrainerNetworkAvailable"
  }
}
