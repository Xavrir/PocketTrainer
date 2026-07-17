package com.pockettrainer.nutrition

import android.app.Activity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

/** Uses Google Code Scanner's hosted camera UI; the app does not own a scanner camera view. */
class FoodScannerModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    private var scanning = false

    override fun getName() = "FoodScanner"

    @ReactMethod
    fun startScan(promise: Promise) {
        if (scanning) {
            promise.reject("FOOD_SCANNER_BUSY", "A barcode scan is already in progress.")
            return
        }

        val activity: Activity = reactContext.currentActivity
            ?: run {
                promise.reject("FOOD_SCANNER_UNAVAILABLE", "The scanner is not ready.")
                return
            }

        scanning = true
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_EAN_13,
                Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_UPC_A,
            )
            .build()

        GmsBarcodeScanning.getClient(activity, options)
            .startScan()
            .addOnSuccessListener { barcode ->
                scanning = false
                val normalized = FoodBarcodeParser.normalize(barcode.rawValue, barcode.format)
                if (normalized == null) {
                    promise.resolve(mapResult("error", reason = "Barcode kosong atau format tidak didukung."))
                } else {
                    promise.resolve(mapResult("success", barcode = normalized))
                }
            }
            .addOnCanceledListener {
                scanning = false
                promise.resolve(mapResult("cancelled"))
            }
            .addOnFailureListener { error ->
                scanning = false
                promise.resolve(
                    mapResult(
                        "error",
                        reason = error.message ?: "Pemindaian barcode gagal. Coba lagi atau masukkan manual.",
                    ),
                )
            }
    }

    override fun invalidate() {
        scanning = false
        super.invalidate()
    }

    private fun mapResult(
        status: String,
        barcode: String? = null,
        reason: String? = null,
    ) = com.facebook.react.bridge.Arguments.createMap().apply {
        putString("status", status)
        barcode?.let { putString("barcode", it) }
        reason?.let { putString("reason", it) }
    }
}
