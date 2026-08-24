package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun LoginScreen(model: AppViewModel) {
  var login by rememberSaveable { mutableStateOf("") }
  var password by rememberSaveable { mutableStateOf("") }
  var totp by rememberSaveable { mutableStateOf("") }
  if (model.totpTicket != null) {
    AuthScaffold(
      title = "Двухфакторка",
      subtitle = "Введите код из приложения-аутентификатора",
      error = model.error,
      busy = model.busy,
      action = "Продолжить",
      onAction = { model.loginTotp(totp) },
      alt = "Назад ко входу",
      onAlt = model::cancelTotp,
    ) {
      AuthField("Код из приложения", totp, { totp = it.filter { ch -> ch.isDigit() }.take(8) }, KeyboardType.Number)
    }
    return
  }
  AuthScaffold(
    title = if (model.addingAccount) "Добавить аккаунт" else "С возвращением",
    subtitle = if (model.addingAccount) "Войдите во второй аккаунт. Текущий сохранится." else "Войдите в TetherChat",
    error = model.error,
    busy = model.busy,
    action = "Войти",
    onAction = { model.login(login, password) },
    alt = if (model.addingAccount) "Отмена" else "Нет аккаунта? Регистрация",
    onAlt = if (model.addingAccount) model::cancelAddAccount else model::goRegister,
    extra = {
      TextButton(onClick = model::goForgot) { Text("Забыли пароль?", color = Brand) }
    },
  ) {
    AuthField("Email или имя пользователя", login, { login = it })
    AuthField("Пароль", password, { password = it }, password = true)
  }
}

@Composable
fun RegisterScreen(model: AppViewModel) {
  var email by rememberSaveable { mutableStateOf("") }
  var username by rememberSaveable { mutableStateOf("") }
  var password by rememberSaveable { mutableStateOf("") }
  AuthScaffold(
    title = "Создать аккаунт",
    subtitle = "Это займёт меньше минуты",
    error = model.error,
    busy = model.busy,
    action = "Продолжить",
    onAction = { model.register(email, username, password) },
    alt = "Уже есть аккаунт? Войти",
    onAlt = model::goLogin,
  ) {
    AuthField("Email", email, { email = it }, KeyboardType.Email)
    AuthField("Имя пользователя", username, { username = it })
    AuthField("Пароль", password, { password = it }, password = true)
  }
}

@Composable
fun ForgotPasswordScreen(model: AppViewModel) {
  var email by rememberSaveable { mutableStateOf("") }
  AuthScaffold(
    title = "Сброс пароля",
    subtitle = "На почту придёт ссылка для нового пароля",
    error = model.error,
    busy = model.busy,
    action = "Отправить ссылку",
    onAction = { model.forgot(email) },
    alt = "Назад ко входу",
    onAlt = model::goLogin,
  ) {
    AuthField("Email", email, { email = it }, KeyboardType.Email)
  }
}

@Composable
fun ResetPasswordScreen(model: AppViewModel, token: String) {
  var password by rememberSaveable { mutableStateOf("") }
  AuthScaffold(
    title = "Новый пароль",
    subtitle = "Придумайте пароль для входа",
    error = model.error,
    busy = model.busy,
    action = "Сохранить пароль",
    onAction = { model.resetPassword(token, password) },
    alt = "Назад ко входу",
    onAlt = model::goLogin,
  ) {
    AuthField("Новый пароль", password, { password = it }, password = true)
  }
}

@Composable
fun VerifyEmailScreen(model: AppViewModel, token: String) {
  LaunchedEffect(token) { model.verifyEmailToken(token) }
  AuthScaffold(
    title = "Подтверждение почты",
    subtitle = if (model.busy) "Проверяем ссылку…" else "Можно вернуться ко входу",
    error = model.error,
    busy = model.busy,
    action = "Ко входу",
    onAction = model::goLogin,
    alt = null,
    onAlt = null,
  ) {}
}

@Composable
private fun AuthScaffold(
  title: String,
  subtitle: String,
  error: String?,
  busy: Boolean,
  action: String,
  onAction: () -> Unit,
  alt: String?,
  onAlt: (() -> Unit)?,
  extra: @Composable () -> Unit = {},
  fields: @Composable () -> Unit,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .imePadding()
      .padding(24.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text("TetherChat", color = Brand, fontSize = 22.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(24.dp))
    Text(title, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold)
    Text(subtitle, color = TextMuted, fontSize = 15.sp)
    Spacer(Modifier.height(20.dp))
    Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      fields()
    }
    if (!error.isNullOrBlank()) {
      Spacer(Modifier.height(8.dp))
      Text(error, color = Danger, fontSize = 14.sp)
    }
    Spacer(Modifier.height(16.dp))
    Button(
      onClick = onAction,
      enabled = !busy,
      colors = ButtonDefaults.buttonColors(containerColor = Brand),
      shape = RoundedCornerShape(8.dp),
      modifier = Modifier.fillMaxWidth().height(48.dp),
    ) {
      Text(if (busy) "…" else action, fontWeight = FontWeight.SemiBold)
    }
    extra()
    if (alt != null && onAlt != null) {
      TextButton(onClick = onAlt) { Text(alt, color = Brand) }
    }
  }
}

@Composable
private fun AuthField(
  label: String,
  value: String,
  onChange: (String) -> Unit,
  keyboard: KeyboardType = KeyboardType.Text,
  password: Boolean = false,
) {
  OutlinedTextField(
    value = value,
    onValueChange = onChange,
    label = { Text(label) },
    singleLine = true,
    visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
    keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard),
    modifier = Modifier.fillMaxWidth(),
    colors = OutlinedTextFieldDefaults.colors(
      focusedTextColor = TextPrimary,
      unfocusedTextColor = TextPrimary,
      focusedBorderColor = Brand,
      unfocusedBorderColor = TextMuted,
      focusedLabelColor = TextMuted,
      unfocusedLabelColor = TextMuted,
      cursorColor = Brand,
    ),
  )
}
