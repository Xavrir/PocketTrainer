package com.pockettrainer.nutrition

import com.google.mlkit.vision.barcode.common.Barcode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FoodBarcodeParserTest {
    @Test
    fun acceptsOnlyTheFourNutritionProductFormats() {
        assertEquals("8991234567890", FoodBarcodeParser.normalize("8991234567890", Barcode.FORMAT_EAN_13))
        assertEquals("12345678", FoodBarcodeParser.normalize("12345678", Barcode.FORMAT_EAN_8))
        assertEquals("012345678905", FoodBarcodeParser.normalize("012345678905", Barcode.FORMAT_UPC_A))
    }

    @Test
    fun rejectsEmptyUnsupportedAndWrongLengthValues() {
        assertNull(FoodBarcodeParser.normalize(null, Barcode.FORMAT_EAN_13))
        assertNull(FoodBarcodeParser.normalize("899123456789O", Barcode.FORMAT_EAN_13))
        assertNull(FoodBarcodeParser.normalize("123456789012", Barcode.FORMAT_EAN_13))
        assertNull(FoodBarcodeParser.normalize("123456789012", Barcode.FORMAT_CODE_128))
    }
}
