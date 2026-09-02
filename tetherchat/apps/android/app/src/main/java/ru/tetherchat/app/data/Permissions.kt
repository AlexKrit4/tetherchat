package ru.tetherchat.app.data

object Perm {
  const val VIEW_CHANNEL = 1 shl 0
  const val SEND_MESSAGES = 1 shl 1
  const val MANAGE_MESSAGES = 1 shl 2
  const val MANAGE_CHANNELS = 1 shl 3
  const val MANAGE_ROLES = 1 shl 4
  const val MANAGE_SERVER = 1 shl 5
  const val KICK_MEMBERS = 1 shl 6
  const val BAN_MEMBERS = 1 shl 7
  const val CREATE_INVITE = 1 shl 8
  const val ATTACH_FILES = 1 shl 9
  const val ADD_REACTIONS = 1 shl 10
  const val MENTION_EVERYONE = 1 shl 11
  const val ADMINISTRATOR = 1 shl 12

  val ALL = listOf(
    ADMINISTRATOR to "Администратор",
    VIEW_CHANNEL to "Видеть каналы",
    SEND_MESSAGES to "Писать сообщения",
    MANAGE_MESSAGES to "Управлять сообщениями",
    MANAGE_CHANNELS to "Управлять каналами",
    MANAGE_ROLES to "Управлять ролями",
    MANAGE_SERVER to "Управлять сервером",
    KICK_MEMBERS to "Исключать",
    BAN_MEMBERS to "Банить",
    CREATE_INVITE to "Создавать приглашения",
    ATTACH_FILES to "Вложения",
    ADD_REACTIONS to "Реакции",
    MENTION_EVERYONE to "@everyone",
  )
}

fun Int.hasFlag(flag: Int): Boolean = (this and flag) == flag

fun Int.can(flag: Int): Boolean = hasFlag(Perm.ADMINISTRATOR) || hasFlag(flag)

fun Int.toggle(flag: Int): Int = if (hasFlag(flag)) this and flag.inv() else this or flag
