<?php
require_once __DIR__ . '/env.php';

// E-mail não aceita var() do CSS: estas são as únicas cores literais do back-end.
// Espelham a paleta de src/theme/palette.css — mantenha as duas em sincronia.
$GLOBALS['EMAIL_COR'] = [
    'orange'            => '#d56606',
    'orange_rgb'        => '213,102,6',
    'magenta_light'     => '#e04cc5',
    'magenta_light_rgb' => '224,76,197',
    'purple'            => '#5a0781',
    'purple_dark'       => '#310840',
    'white'             => '#ffffff',
];

function sendEmail(string $to, string $subject, string $html): bool {
    if (RESEND_API_KEY === 're_COLOQUE_SUA_CHAVE_AQUI') {
        error_log("[EMAIL DEV] Para: $to | Assunto: $subject");
        return true;
    }

    $payload = json_encode([
        'from'    => EMAIL_FROM_NAME . ' <' . EMAIL_FROM . '>',
        'to'      => [$to],
        'subject' => $subject,
        'html'    => $html,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . RESEND_API_KEY,
        ],
        CURLOPT_TIMEOUT        => 10,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        error_log("[EMAIL ERRO] cURL: $curlErr | Para: $to");
        return false;
    }

    if ($httpCode >= 400) {
        error_log("[EMAIL ERRO] HTTP {$httpCode} | Para: $to | Assunto: $subject | Resposta: $response");
        return false;
    }

    return true;
}

function sendLoginCodeEmail(string $email, string $code): bool {
    return sendEmail($email, 'Seu código de acesso — Pior Campeonato de Bici Polo — Curitiba 2026', loginCodeTemplate($code));
}

function sendConfirmationEmail(string $email, string $nome, string $codigo, float $valorPendente = 0.0): bool {
    return sendEmail($email, 'Inscrição recebida! 🎉 — Pior Campeonato de Bici Polo — Curitiba 2026', confirmationTemplate($nome, $codigo, $valorPendente));
}

function sendPaymentPendingEmail(string $email, string $nome, float $valor): bool {
    return sendEmail($email, 'Pagamento pendente — Pior Campeonato de Bici Polo — Curitiba 2026', paymentPendingTemplate($nome, $valor));
}

function sendTeamInviteEmail(string $email, string $nomeTime, string $codigo, string $categoria): bool {
    return sendEmail($email, "Convite para o time {$nomeTime} — Pior Campeonato de Bici Polo — Curitiba 2026", teamInviteTemplate($nomeTime, $codigo, $categoria));
}

function sendPaymentApprovedEmail(string $email, string $nome, string $tipo, string $tipoLabel, float $valor): bool {
    return sendEmail($email, 'Pagamento confirmado ✅ — Pior Campeonato de Bici Polo — Curitiba 2026', paymentApprovedTemplate($nome, $tipo, $tipoLabel, $valor));
}

function sendPaymentRejectedEmail(string $email, string $nome, string $tipoLabel): bool {
    return sendEmail($email, 'Pagamento não aprovado — Pior Campeonato de Bici Polo — Curitiba 2026', paymentRejectedTemplate($nome, $tipoLabel));
}

function sendServiceUpdatedEmail(string $email, string $nome, string $tipo, string $detalhes): bool {
    $assunto = ($tipo === 'alimentação') ? 'Alimentação atualizada' : 'Alojamento atualizado';
    return sendEmail($email, "{$assunto} — Pior Campeonato de Bici Polo — Curitiba 2026", serviceUpdatedTemplate($nome, $tipo, $detalhes));
}

function sendCancellationEmail(string $email, string $nome, bool $houvePagemento): bool {
    return sendEmail($email, 'Sua inscrição foi cancelada — Pior Campeonato de Bici Polo — Curitiba 2026', cancellationTemplate($nome, $houvePagemento));
}

function sendLojaOrderConfirmedEmail(string $email, string $nome, string $codigoRetirada, array $itens, float $valor): bool {
    return sendEmail($email, 'Compra confirmada na Lojinha! 🎉 — Pior Campeonato de Bici Polo — Curitiba 2026', lojaOrderTemplate($nome, $codigoRetirada, $itens, $valor));
}

function sendWalletMagicLinkEmail(string $email, string $nome, string $token): bool {
    return sendEmail($email, 'Acesse sua carteira — Pior Campeonato de Bici Polo — Curitiba 2026', walletMagicLinkTemplate($nome, $token));
}

// ── Templates ─────────────────────────────────────────────

function emailWrapper(string $content): string {
    $logoUrl = APP_URL . '/identidade/logo.svg';
    return <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:{$GLOBALS['EMAIL_COR']['purple_dark']};font-family:'Arial Narrow',Arial,sans-serif;color:{$GLOBALS['EMAIL_COR']['white']};">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:{$GLOBALS['EMAIL_COR']['purple']};padding:28px 28px 20px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.10);border-radius:12px;padding:14px 24px;margin-bottom:14px;">
                <img src="{$logoUrl}" alt="2° Pior Campeonato de Bici Polo" height="64" style="display:block;max-width:220px;">
              </div>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.50);letter-spacing:0.14em;text-transform:uppercase;">
                2° Pior Campeonato de Bici Polo · Curitiba 2026
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-top:none;padding:36px 32px;">
              {$content}
            </td>
          </tr>
          <tr>
            <td style="padding:16px;text-align:center;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">
                Email enviado automaticamente. Para dúvidas, entre em contato nos canais oficiais.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
}

function loginCodeTemplate(string $code): string {
    $content = <<<HTML
<p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#fff;text-align:center;">
  Seu código de acesso
</p>
<p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;text-align:center;">
  Use este código para entrar na área da pessoa atleta.<br>
  Expira em <strong style="color:{$GLOBALS['EMAIL_COR']['orange']};">10 minutos</strong>.
</p>
<div style="text-align:center;margin-bottom:28px;">
  <span style="display:inline-block;font-size:46px;font-weight:900;letter-spacing:0.28em;color:{$GLOBALS['EMAIL_COR']['orange']};background:rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.12);border:2px solid rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.35);padding:14px 24px;">
    {$code}
  </span>
</div>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.30);text-align:center;line-height:1.5;">
  Não solicitou? Pode ignorar este email 💛
</p>
HTML;
    return emailWrapper($content);
}

function walletMagicLinkTemplate(string $nome, string $token): string {
    $primeiroNome = htmlspecialchars(explode(' ', trim($nome))[0] ?: $nome, ENT_QUOTES, 'UTF-8');
    $url = APP_URL . '/carteira/acesso?token=' . rawurlencode($token);
    $content = <<<HTML
<p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#fff;">
  Sua carteira está pronta
</p>
<p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.60);line-height:1.6;">
  Oi <strong style="color:#fff;">{$primeiroNome}</strong>! Use o botão abaixo para acessar sua carteira do Pior Campeonato de Bici Polo.
</p>
<p style="margin:0 0 26px;">
  <a href="{$url}" style="display:inline-block;padding:14px 26px;background:{$GLOBALS['EMAIL_COR']['orange']};color:{$GLOBALS['EMAIL_COR']['purple_dark']};font-weight:800;text-decoration:none;border-radius:7px;font-size:14px;">
    ACESSAR MINHA CARTEIRA
  </a>
</p>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.38);line-height:1.55;">
  Este link é pessoal, funciona uma única vez e expira em 15 minutos. Se você não solicitou este acesso, ignore esta mensagem.
</p>
HTML;
    return emailWrapper($content);
}

function confirmationTemplate(string $nome, string $codigo, float $valorPendente = 0.0): string {
    $primeiroNome = explode(' ', $nome)[0];
    $url          = APP_URL . '/minha-inscricao';

    if ($valorPendente > 0) {
        $v = 'R$ ' . number_format($valorPendente, 2, ',', '.');
        $blocoPagemento = <<<HTML
<div style="background:rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.10);border:1px solid rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.35);border-radius:8px;padding:20px 24px;margin:24px 0;">
  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:{$GLOBALS['EMAIL_COR']['orange']};letter-spacing:0.06em;text-transform:uppercase;">
    Falta só o pagamento!
  </p>
  <p style="margin:0 0 14px;font-size:14px;color:rgba(255,255,255,0.70);line-height:1.6;">
    Total a pagar: <strong style="color:#fff;">{$v}</strong>
  </p>
  <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.7;">
    <strong style="color:rgba(255,255,255,0.80);">Como pagar:</strong><br>
    1. Acesse <a href="{$url}" style="color:{$GLOBALS['EMAIL_COR']['orange']};">sua área da pessoa atleta</a><br>
    2. Faça login com o seu email (você receberá um código de acesso)<br>
    3. Clique em <strong style="color:#fff;">Pagar</strong> na seção da sua inscrição<br>
    4. Escolha PIX ou cartão de crédito
  </p>
</div>
HTML;
    } else {
        $blocoPagemento = <<<HTML
<div style="background:rgba({$GLOBALS['EMAIL_COR']['magenta_light_rgb']},0.10);border:1px solid rgba({$GLOBALS['EMAIL_COR']['magenta_light_rgb']},0.30);border-radius:8px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0;font-size:14px;color:{$GLOBALS['EMAIL_COR']['magenta_light']};line-height:1.6;">
    Você está isenta/isento de pagamento — sua vaga já está confirmada! 🎉
  </p>
</div>
HTML;
    }

    $content = <<<HTML
<p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#fff;">
  Inscrição recebida! 🎉
</p>
<p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Oi <strong style="color:#fff;">{$primeiroNome}</strong>! Que bom ter você no Pior Campeonato de Bici Polo.
  Sua inscrição foi salva com sucesso — guarde o código abaixo.
</p>
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.40);">
  Código da inscrição
</p>
<p style="margin:0 0 4px;font-size:36px;font-weight:900;letter-spacing:0.20em;color:{$GLOBALS['EMAIL_COR']['orange']};">
  #{$codigo}
</p>
<p style="margin:0 0 0;font-size:12px;color:rgba(255,255,255,0.30);line-height:1.5;">
  Use este código se precisar identificar sua inscrição junto à organização.
</p>
{$blocoPagemento}
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.40);line-height:1.6;">
  Na <a href="{$url}" style="color:{$GLOBALS['EMAIL_COR']['orange']};">área da pessoa atleta</a> você acompanha o status da inscrição,
  gerencia alimentação e alojamento, e acessa o histórico de pagamentos.
</p>
HTML;
    return emailWrapper($content);
}

function paymentPendingTemplate(string $nome, float $valor): string {
    $v   = 'R$ ' . number_format($valor, 2, ',', '.');
    $url = APP_URL . '/minha-inscricao';
    $content = <<<HTML
<p style="margin:0 0 16px;font-size:24px;font-weight:700;color:#fff;">
  Pagamento pendente
</p>
<p style="margin:0 0 8px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Oi <strong style="color:#fff;">{$nome}</strong>! Há um pagamento pendente na sua inscrição.
</p>
<p style="margin:0 0 24px;font-size:32px;font-weight:900;color:{$GLOBALS['EMAIL_COR']['orange']};">{$v}</p>
<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.50);line-height:1.55;">
  Acesse a <a href="{$url}" style="color:{$GLOBALS['EMAIL_COR']['orange']};">área da pessoa atleta</a> para realizar o pagamento via PIX ou cartão.
</p>
HTML;
    return emailWrapper($content);
}

function teamInviteTemplate(string $nomeTime, string $codigo, string $categoria): string {
    $catLabel = $categoria === 'misto' ? 'Brasileiro Misto' : 'Brasileiro MTNB';
    $content  = <<<HTML
<p style="margin:0 0 16px;font-size:24px;font-weight:700;color:#fff;">
  Convite para o time
</p>
<p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Você foi convidadx para entrar no time <strong style="color:#fff;">{$nomeTime}</strong>
  no <strong style="color:#fff;">{$catLabel}</strong>.
</p>
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.40);">
  Código do time
</p>
<p style="margin:0 0 24px;font-size:36px;font-weight:900;letter-spacing:0.22em;color:{$GLOBALS['EMAIL_COR']['orange']};">
  {$codigo}
</p>
<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.50);line-height:1.55;">
  Use este código ao se inscrever no campeonato para entrar diretamente no time.
</p>
HTML;
    return emailWrapper($content);
}

function paymentApprovedTemplate(string $nome, string $tipo, string $tipoLabel, float $valor): string {
    $primeiroNome = explode(' ', $nome)[0];
    $v            = 'R$ ' . number_format($valor, 2, ',', '.');
    $url          = APP_URL . '/minha-inscricao';

    if (in_array($tipo, ['inscricao', 'checkout', 'completo'])) {
        $mensagem = <<<HTML
<p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.65;">
  Você está confirmadx no <strong style="color:#fff;">2° Pior Campeonato de Bici Polo</strong>!
  Nos vemos em Florianópolis de 5 a 7 de setembro de 2026. Vai ser incrível! 🚴
</p>
<p style="margin:0 0 0;font-size:14px;color:rgba(255,255,255,0.45);line-height:1.65;">
  Se você contratou alimentação ou alojamento, eles já estão confirmados também.
  Se ainda não contratou e quiser, acesse a
  <a href="{$url}" style="color:{$GLOBALS['EMAIL_COR']['orange']};">área da pessoa atleta</a> — esses serviços podem ser adicionados a qualquer momento.
</p>
HTML;
    } elseif ($tipo === 'alimentacao') {
        $mensagem = <<<HTML
<p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.65;">
  Sua alimentação no Pior Campeonato de Bici Polo está garantida! Café da manhã, almoço e lanche da tarde
  nos dias selecionados. Cuide-se bem antes do campeonato! 🌱
</p>
<p style="margin:0 0 0;font-size:14px;color:rgba(255,255,255,0.45);line-height:1.65;">
  Veja o resumo completo na
  <a href="{$url}" style="color:{$GLOBALS['EMAIL_COR']['orange']};">área da pessoa atleta</a>.
</p>
HTML;
    } else {
        $mensagem = <<<HTML
<p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.65;">
  Sua hospedagem no Pior Campeonato de Bici Polo está garantida! Você tem uma vaga confirmada no ginásio
  do evento nos dias selecionados. 🏠
</p>
<p style="margin:0 0 0;font-size:14px;color:rgba(255,255,255,0.45);line-height:1.65;">
  Veja o resumo completo na
  <a href="{$url}" style="color:{$GLOBALS['EMAIL_COR']['orange']};">área da pessoa atleta</a>.
</p>
HTML;
    }

    $content = <<<HTML
<p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#fff;">
  Pagamento confirmado! ✅
</p>
<p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Oi <strong style="color:#fff;">{$primeiroNome}</strong>! Recebemos seu pagamento com sucesso.
</p>
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.40);">
  {$tipoLabel}
</p>
<p style="margin:0 0 24px;font-size:36px;font-weight:900;color:{$GLOBALS['EMAIL_COR']['magenta_light']};">{$v}</p>
<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:20px 22px;margin-bottom:0;">
  {$mensagem}
</div>
HTML;
    return emailWrapper($content);
}

function paymentRejectedTemplate(string $nome, string $tipoLabel): string {
    $primeiroNome = explode(' ', $nome)[0];
    $url          = APP_URL . '/minha-inscricao';
    $content      = <<<HTML
<p style="margin:0 0 6px;font-size:24px;font-weight:700;color:#fff;">
  Pagamento não aprovado
</p>
<p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Oi <strong style="color:#fff;">{$primeiroNome}</strong>! Infelizmente, o pagamento de
  <strong style="color:#fff;">{$tipoLabel}</strong> não foi aprovado.
</p>
<p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.50);line-height:1.55;">
  Não se preocupe — sua inscrição continua salva. Isso pode acontecer por dados de cartão
  incorretos, limite insuficiente ou instabilidade momentânea. Você pode tentar novamente
  a qualquer hora pela área da pessoa atleta.
</p>
<p style="margin:0;">
  <a href="{$url}" style="display:inline-block;padding:12px 28px;background:{$GLOBALS['EMAIL_COR']['orange']};color:{$GLOBALS['EMAIL_COR']['purple_dark']};font-weight:700;text-decoration:none;border-radius:6px;font-size:14px;">
    Tentar novamente
  </a>
</p>
HTML;
    return emailWrapper($content);
}

function serviceUpdatedTemplate(string $nome, string $tipo, string $detalhes): string {
    $primeiroNome = explode(' ', $nome)[0];
    $url          = APP_URL . '/minha-inscricao';
    $tipoLabel    = ($tipo === 'alimentação') ? 'Alimentação' : 'Alojamento';
    $participio   = ($tipo === 'alimentação') ? 'atualizada' : 'atualizado';

    if ($tipo === 'alimentação') {
        $descricao = 'Café da manhã, almoço e lanche da tarde incluídos em cada dia selecionado 🌱';
    } else {
        $descricao = 'Hospedagem no ginásio do evento nos dias selecionados 🏠';
    }

    $content = <<<HTML
<p style="margin:0 0 6px;font-size:24px;font-weight:700;color:#fff;">
  {$tipoLabel} {$participio}! ✅
</p>
<p style="margin:0 0 6px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Oi <strong style="color:#fff;">{$primeiroNome}</strong>! Sua {$tipo} foi {$participio} com sucesso.
</p>
<p style="margin:0 0 20px;font-size:13px;color:rgba(255,255,255,0.40);line-height:1.5;">
  {$descricao}
</p>
<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:8px;padding:16px 20px;margin-bottom:20px;font-size:14px;color:rgba(255,255,255,0.70);line-height:1.8;">
  {$detalhes}
</div>
<div style="background:rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.10);border:1px solid rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.30);border-radius:8px;padding:14px 18px;margin-bottom:0;">
  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.6;">
    <strong style="color:{$GLOBALS['EMAIL_COR']['orange']};">Lembrete importante:</strong>
    a reserva só fica garantida após o pagamento.
    Se ainda não pagou, acesse a
    <a href="{$url}" style="color:{$GLOBALS['EMAIL_COR']['orange']};">área da pessoa atleta</a> e finalize agora — não deixa pra depois! 😉
  </p>
</div>
HTML;
    return emailWrapper($content);
}

function cancellationTemplate(string $nome, bool $houvePagemento): string {
    $primeiroNome = explode(' ', $nome)[0];

    if ($houvePagemento) {
        $blocoReembolso = <<<HTML
<div style="background:rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.10);border:1px solid rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.30);border-radius:8px;padding:16px 20px;margin:20px 0;">
  <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.70);line-height:1.65;">
    <strong style="color:{$GLOBALS['EMAIL_COR']['orange']};">Sobre o reembolso:</strong> identificamos pagamento(s) realizados
    nessa inscrição. Alguém da organização entrará em contato com você pelo WhatsApp ou email
    para solicitar sua chave PIX e processar o reembolso.
  </p>
</div>
HTML;
    } else {
        $blocoReembolso = '';
    }

    $content = <<<HTML
<p style="margin:0 0 6px;font-size:24px;font-weight:700;color:#fff;">
  Inscrição cancelada
</p>
<p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Oi <strong style="color:#fff;">{$primeiroNome}</strong>. Sua inscrição no Pior Campeonato de Bici Polo — Curitiba 2026
  foi cancelada pela organização.
</p>
{$blocoReembolso}
<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.40);line-height:1.6;">
  Se isso foi um engano ou você tiver alguma dúvida, entre em contato com a organização
  pelos canais oficiais. Esperamos te ver numa próxima edição! 💛
</p>
HTML;
    return emailWrapper($content);
}

function lojaOrderTemplate(string $nome, string $codigoRetirada, array $itens, float $valor): string {
    $primeiroNome = explode(' ', $nome)[0];
    $v            = 'R$ ' . number_format($valor, 2, ',', '.');

    $linhasItens = '';
    foreach ($itens as $item) {
        $tamanho  = !empty($item['tamanho']) ? " ({$item['tamanho']})" : '';
        $subtotal = 'R$ ' . number_format($item['quantidade'] * $item['preco_unitario'], 2, ',', '.');
        $linhasItens .= <<<HTML
<tr>
  <td style="padding:8px 0;font-size:14px;color:rgba(255,255,255,0.70);border-bottom:1px solid rgba(255,255,255,0.08);">
    {$item['quantidade']}× {$item['produto_nome']}{$tamanho}
  </td>
  <td style="padding:8px 0;font-size:14px;color:#fff;text-align:right;border-bottom:1px solid rgba(255,255,255,0.08);">
    {$subtotal}
  </td>
</tr>
HTML;
    }

    $content = <<<HTML
<p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#fff;">
  Compra confirmada! 🎉
</p>
<p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.55;">
  Oi <strong style="color:#fff;">{$primeiroNome}</strong>! Recebemos seu pagamento e sua compra na
  Lojinha do Pior Campeonato de Bici Polo está confirmada.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
  {$linhasItens}
</table>
<p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.55);text-align:right;">
  Total pago: <strong style="color:{$GLOBALS['EMAIL_COR']['magenta_light']};font-size:18px;">{$v}</strong>
</p>
<div style="background:rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.10);border:1px solid rgba({$GLOBALS['EMAIL_COR']['orange_rgb']},0.35);border-radius:8px;padding:20px 24px;margin-bottom:20px;text-align:center;">
  <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.40);">
    Código de retirada
  </p>
  <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:0.20em;color:{$GLOBALS['EMAIL_COR']['orange']};">
    {$codigoRetirada}
  </p>
</div>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.40);line-height:1.6;">
  Apresente este código à organização durante o evento para retirar seus produtos.
  Guarde este email até o dia da retirada.
</p>
HTML;
    return emailWrapper($content);
}
