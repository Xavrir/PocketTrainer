package com.pockettrainer.nutrition

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.MediaStore
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Reads a selected or captured label image into bounded memory, then deletes any temporary capture. */
class FoodImagePickerModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    private var pendingPromise: Promise? = null
    private var pendingCaptureFile: File? = null
    private var pendingCaptureUri: Uri? = null
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = "FoodImagePicker"

    @ReactMethod
    fun pickImage(promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("IMAGE_PICKER_BUSY", "A food image selection is already in progress.")
            return
        }
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("IMAGE_PICKER_UNAVAILABLE", "The food image picker is not ready.")
            return
        }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startImageActivity(intent, promise, null, null)
    }

    @ReactMethod
    fun captureImage(promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("IMAGE_PICKER_BUSY", "A food image selection is already in progress.")
            return
        }
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("IMAGE_PICKER_UNAVAILABLE", "The food image picker is not ready.")
            return
        }
        val captureFile = File(reactContext.cacheDir, "food-camera").also { it.mkdirs() }
            .let { File.createTempFile("capture-", ".jpg", it) }
        val captureUri = androidx.core.content.FileProvider.getUriForFile(
            reactContext,
            "${reactContext.packageName}.fileprovider",
            captureFile,
        )
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, captureUri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startImageActivity(intent, promise, captureFile, captureUri)
    }

    private fun startImageActivity(intent: Intent, promise: Promise, captureFile: File?, captureUri: Uri?) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            captureFile?.delete()
            promise.reject("IMAGE_PICKER_UNAVAILABLE", "The food image picker is not ready.")
            return
        }
        pendingPromise = promise
        pendingCaptureFile = captureFile
        pendingCaptureUri = captureUri
        try {
            activity.startActivityForResult(intent, REQUEST_CODE)
        } catch (_: ActivityNotFoundException) {
            pendingPromise = null
            pendingCaptureUri = null
            pendingCaptureFile?.delete()
            pendingCaptureFile = null
            promise.reject("IMAGE_PICKER_UNAVAILABLE", "No image picker is installed on this device.")
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE) return
        val promise = pendingPromise ?: return
        pendingPromise = null
        val captureFile = pendingCaptureFile
        val captureUri = pendingCaptureUri
        pendingCaptureFile = null
        pendingCaptureUri = null
        val uri = if (resultCode == Activity.RESULT_OK) data?.data ?: captureUri else null
        if (uri == null) {
            captureFile?.delete()
            promise.resolve(null)
            return
        }
        executor.execute {
            try {
                promise.resolve(readImage(uri, if (captureUri != null) "image/jpeg" else null))
            } catch (_: IllegalArgumentException) {
                promise.reject("IMAGE_INVALID", "Choose a JPEG, PNG, or WebP food label image under 700 KB after processing.")
            } catch (_: Exception) {
                promise.reject("IMAGE_READ_FAILED", "The selected food image could not be read safely.")
            } finally {
                captureFile?.delete()
            }
        }
    }

    override fun onNewIntent(intent: Intent) = Unit

    override fun invalidate() {
        pendingPromise?.reject("IMAGE_PICKER_CANCELLED", "The food image picker was closed.")
        pendingPromise = null
        pendingCaptureFile?.delete()
        pendingCaptureFile = null
        pendingCaptureUri = null
        executor.shutdownNow()
        reactContext.removeActivityEventListener(this)
        super.invalidate()
    }

    private fun readImage(uri: Uri, fallbackMimeType: String?) = run {
        val resolver = reactContext.contentResolver
        val mimeType = (resolver.getType(uri) ?: fallbackMimeType)?.lowercase()
        if (mimeType !in SUPPORTED_MIME_TYPES) {
            throw IllegalArgumentException("Unsupported image MIME type")
        }

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            throw IllegalArgumentException("Unreadable image")
        }

        val options = BitmapFactory.Options().apply {
            inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight)
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
            ?: throw IllegalArgumentException("Unreadable image")
        try {
            val compressed = compressForReview(bitmap)
            val result = Arguments.createMap()
            result.putString("imageBase64", Base64.encodeToString(compressed, Base64.NO_WRAP))
            result.putString("mimeType", "image/jpeg")
            result.putInt("sizeBytes", compressed.size)
            result
        } finally {
            bitmap.recycle()
        }
    }

    private fun compressForReview(bitmap: Bitmap): ByteArray {
        var quality = 82
        while (quality >= 45) {
            val output = ByteArrayOutputStream()
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
                throw IllegalArgumentException("Image compression failed")
            }
            val bytes = output.toByteArray()
            if (bytes.size <= MAX_IMAGE_BYTES) return bytes
            quality -= 13
        }
        throw IllegalArgumentException("Image is too large")
    }

    private fun sampleSize(width: Int, height: Int): Int {
        var sample = 1
        while (width / sample > MAX_DIMENSION || height / sample > MAX_DIMENSION) {
            sample *= 2
        }
        return sample
    }

    companion object {
        private const val REQUEST_CODE = 4107
        private const val MAX_DIMENSION = 1600
        private const val MAX_IMAGE_BYTES = 700_000
        private val SUPPORTED_MIME_TYPES = setOf("image/jpeg", "image/png", "image/webp")
    }
}
