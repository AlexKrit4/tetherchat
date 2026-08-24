package ru.tetherchat.app.data

import android.app.Application
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

class E2eeManager(
  private val app: Application,
  private val api: TetherApi,
) {
  private val preferences = app.getSharedPreferences("tetherchat.e2ee", Application.MODE_PRIVATE)
  private val conversationKeys = ConcurrentHashMap<String, ByteArray>()
  private val random = SecureRandom()

  fun ensureDevice(userId: String): String {
    val deviceIdKey = "device.$userId"
    var deviceId = preferences.getString(deviceIdKey, null) ?: UUID.randomUUID().toString().also {
      preferences.edit().putString(deviceIdKey, it).apply()
    }
    val pair = ensureIdentityKey(userId)
    val publicKey = encode(pair.certificate.publicKey.encoded)
    val storedPublicKey = preferences.getString("public.$userId", null)
    if (storedPublicKey != null && storedPublicKey != publicKey) {
      runCatching { api.revokeCryptoDevice(deviceId) }
      deviceId = UUID.randomUUID().toString()
      preferences.edit().putString(deviceIdKey, deviceId).apply()
    }
    preferences.edit().putString("public.$userId", publicKey).apply()
    api.registerCryptoDevice(
      CryptoDeviceBody(
        deviceId = deviceId,
        name = "${Build.MANUFACTURER} ${Build.MODEL}",
        publicKey = publicKey,
      ),
    )
    return deviceId
  }

  fun createSecretConversation(userId: String, friendId: String): DirectConversation {
    ensureDevice(userId)
    val devices = api.cryptoDevices(userId) + api.cryptoDevices(friendId)
    if (devices.none { it.userId == friendId }) {
      throw ApiException(409, "crypto_not_ready", "Друг должен обновить и открыть TetherChat")
    }
    devices.filter { it.userId == friendId }.forEach { device ->
      val pinId = "pinned.$friendId.${device.id}"
      val pinned = preferences.getString(pinId, null)
      if (pinned != null && pinned != device.publicKey) {
        throw ApiException(409, "crypto_key_changed", "Ключ устройства друга изменился")
      }
      preferences.edit().putString(pinId, device.publicKey).apply()
    }
    val rawKey = ByteArray(32).also(random::nextBytes)
    val wrapped = devices.map { device ->
      val publicKey = KeyFactory.getInstance("RSA").generatePublic(
        X509EncodedKeySpec(decode(device.publicKey)),
      )
      val cipher = rsaCipher(Cipher.ENCRYPT_MODE, publicKey)
      WrappedSecretKey(device.id, encode(cipher.doFinal(rawKey)))
    }
    val conversation = api.createSecretConversation(friendId, wrapped)
    conversationKeys[conversation.id] = rawKey
    return conversation
  }

  fun encrypt(userId: String, conversationId: String, content: String): EncryptedEnvelope {
    val key = loadConversationKey(userId, conversationId)
    val iv = ByteArray(12).also(random::nextBytes)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
    cipher.updateAAD(conversationId.toByteArray(Charsets.UTF_8))
    return EncryptedEnvelope(
      version = 1,
      iv = encode(iv),
      ciphertext = encode(cipher.doFinal(content.toByteArray(Charsets.UTF_8))),
    )
  }

  fun decrypt(userId: String, message: Message): Message {
    val envelope = message.encrypted ?: return message
    return runCatching {
      val key = loadConversationKey(userId, message.channelId)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(
        Cipher.DECRYPT_MODE,
        SecretKeySpec(key, "AES"),
        GCMParameterSpec(128, decode(envelope.iv)),
      )
      cipher.updateAAD(message.channelId.toByteArray(Charsets.UTF_8))
      message.copy(content = String(cipher.doFinal(decode(envelope.ciphertext)), Charsets.UTF_8))
    }.getOrElse {
      message.copy(content = "🔒 Не удалось расшифровать сообщение")
    }
  }

  fun safetyNumber(userId: String, friendId: String): String {
    val ownDevices = api.cryptoDevices(userId)
    val friendDevices = api.cryptoDevices(friendId)
    val canonical = (ownDevices + friendDevices)
      .map { "${it.userId}:${it.id}:${it.publicKey}" }
      .sorted()
      .joinToString("|")
    val code = MessageDigest.getInstance("SHA-256")
      .digest(canonical.toByteArray(Charsets.UTF_8))
      .take(15)
      .joinToString("") { "%02x".format(it) }
      .chunked(5)
      .joinToString(" ")
    val devices = (
      ownDevices.map { "Ваше" to it } +
        friendDevices.map { "Друг" to it }
      ).joinToString("\n") { (owner, device) ->
        val keyFingerprint = MessageDigest.getInstance("SHA-256")
          .digest(decode(device.publicKey))
          .take(8)
          .joinToString("") { "%02x".format(it) }
        "$owner: ${device.name ?: device.id} · $keyFingerprint"
      }
    return "$code\nУстройства:\n$devices"
  }

  private fun loadConversationKey(userId: String, conversationId: String): ByteArray {
    conversationKeys[conversationId]?.let { return it }
    val deviceId = ensureDevice(userId)
    val wrapped = api.secretConversationKey(conversationId, deviceId)
    val privateKey = ensureIdentityKey(userId).privateKey
    val raw = rsaCipher(Cipher.DECRYPT_MODE, privateKey).doFinal(decode(wrapped.wrappedKey))
    conversationKeys[conversationId] = raw
    return raw
  }

  private fun ensureIdentityKey(userId: String): KeyStore.PrivateKeyEntry {
    val alias = "tetherchat-e2ee-${fingerprint(userId).take(24)}"
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getEntry(alias, null) as? KeyStore.PrivateKeyEntry)?.let { return it }
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore")
    generator.initialize(
      KeyGenParameterSpec.Builder(
        alias,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setKeySize(2048)
        .setDigests(KeyProperties.DIGEST_SHA1)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
        .build(),
    )
    generator.generateKeyPair()
    store.load(null)
    return store.getEntry(alias, null) as KeyStore.PrivateKeyEntry
  }

  private fun rsaCipher(mode: Int, key: java.security.Key): Cipher =
    Cipher.getInstance("RSA/ECB/OAEPPadding").apply {
      init(
        mode,
        key,
        OAEPParameterSpec(
          "SHA-1",
          "MGF1",
          MGF1ParameterSpec.SHA1,
          PSource.PSpecified.DEFAULT,
        ),
      )
    }

  private fun fingerprint(value: String): String =
    MessageDigest.getInstance("SHA-256")
      .digest(value.toByteArray())
      .joinToString("") { "%02x".format(it) }

  private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
  private fun decode(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)
}
