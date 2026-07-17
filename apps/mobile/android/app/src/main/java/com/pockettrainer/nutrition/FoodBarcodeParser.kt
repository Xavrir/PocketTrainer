package com.pockettrainer.nutrition

import com.google.mlkit.vision.barcode.common.Barcode

/**
 * Keeps the scanner contract deliberately small: only product barcode formats
 * that the nutrition API can resolve are accepted, and the value crossing the
 * React Native boundary contains digits only.
 */
object FoodBarcodeParser {
    fun normalize(rawValue: String?, format: Int): String? {
        val digits = rawValue.orEmpty().trim()
        if (digits.isEmpty() || !digits.all(Char::isDigit)) return null

        val validLength = when (format) {
            Barcode.FORMAT_EAN_13 -> digits.length == 13
            Barcode.FORMAT_EAN_8 -> digits.length == 8
            Barcode.FORMAT_UPC_A -> digits.length == 12
            else -> false
        }
        return digits.takeIf { validLength }
    }
}
