const messages: Record<string, string> = {
  "auth/email-already-in-use": "Este e-mail já está cadastrado.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
};

export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code && messages[code]) return messages[code];
  return "Ocorreu um erro. Tente novamente.";
}
