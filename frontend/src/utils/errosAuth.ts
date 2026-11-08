// Traduz os erros de autenticação para o que a pessoa consegue resolver.
export function mensagemErroAuth(mensagem: string | undefined, padrao: string): string {
  const m = (mensagem ?? '').toLowerCase()
  if (m.includes('invalid api key') || m.includes('no api key')) {
    return 'O sistema está temporariamente indisponível por um erro de configuração. Fale com suporte@axosrelatorios.com.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexão com o servidor. Confira a internet e tente novamente.'
  }
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'E-mail não confirmado. Verifique sua caixa de entrada.'
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Este e-mail já tem cadastro. Entre na plataforma ou recupere a senha.'
  }
  if (m.includes('rate limit') || m.includes('security purposes')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  }
  if (m.includes('should be different')) return 'A nova senha precisa ser diferente da anterior.'
  if (m.includes('password should be') || m.includes('weak password')) {
    return 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.'
  }
  if (m.includes('session') && m.includes('missing')) {
    return 'O link expirou. Peça um novo link de recuperação.'
  }
  if (m.includes('cnpj') || m.includes('cpf') || m.includes('informe o nome') || m.includes('entre na sua conta') || m.includes('escolha um plano') || m.includes('administrador da conta') || m.includes('convite') || m.includes('limite de inspetores') || m.includes('já pertence') || m.includes('e-mail válido') || m.includes('função da pessoa')) return mensagem as string
  return padrao
}
