package com.pockettrainer.offlinestore

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class OfflineKeyManager(private val context: Context) {
  private val preferences =
    context.getSharedPreferences("pockettrainer_offline_key_v1", Context.MODE_PRIVATE)

  fun getOrCreateDatabasePassphrase(): String {
    val wrapped = preferences.getString(KEY_CIPHERTEXT, null)
    val iv = preferences.getString(KEY_IV, null)
    if (wrapped != null || iv != null) {
      require(wrapped != null && iv != null) { "Offline database key metadata is incomplete." }
      return decrypt(wrapped, iv)
    }

    val passphraseBytes = ByteArray(32).also(SecureRandom()::nextBytes)
    val passphrase = Base64.encodeToString(passphraseBytes, Base64.NO_WRAP or Base64.NO_PADDING)
    passphraseBytes.fill(0)
    val encrypted = encrypt(passphrase)
    check(
      preferences.edit()
        .putString(KEY_CIPHERTEXT, encrypted.first)
        .putString(KEY_IV, encrypted.second)
        .commit(),
    ) { "Could not persist the wrapped offline database key." }
    return passphrase
  }

  private fun getOrCreateMasterKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
      init(
        KeyGenParameterSpec.Builder(
          KEY_ALIAS,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
          .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
          .setKeySize(256)
          .setRandomizedEncryptionRequired(true)
          .build(),
      )
      generateKey()
    }
  }

  private fun encrypt(value: String): Pair<String, String> {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateMasterKey())
    val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(ciphertext, Base64.NO_WRAP) to
      Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
  }

  private fun decrypt(ciphertext: String, iv: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(
      Cipher.DECRYPT_MODE,
      getOrCreateMasterKey(),
      GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)),
    )
    return String(
      cipher.doFinal(Base64.decode(ciphertext, Base64.NO_WRAP)),
      Charsets.UTF_8,
    )
  }

  private companion object {
    const val ANDROID_KEYSTORE = "AndroidKeyStore"
    const val KEY_ALIAS = "pockettrainer.offline.master.v1"
    const val KEY_CIPHERTEXT = "wrapped_database_key"
    const val KEY_IV = "wrapped_database_key_iv"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
  }
}
