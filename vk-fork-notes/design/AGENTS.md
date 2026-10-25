# Agente de design: leia antes de mexer

Você faz a **maquete visual** do WA-AKG: telas em HTML + Tailwind, só para ver e aprovar o desenho. Abrem com duplo clique no navegador, sem Node, sem servidor, sem internet. Dados fictícios.

A maquete é **só visual**, mas o desenho aprovado vai depois para o front real (Next.js + React + Tailwind 4), que fala com um servidor que você não vê. O servidor **não muda por causa do design**. Por isso o desenho precisa continuar encaixando no que o sistema real tem e entrega.

O visual é bem flexível. O que não pode mudar é **o que o sistema real mostra, faz e entende**.

Teste rápido antes de mudar algo: *isso muda quais dados a tela mostra, quais ações ela oferece, ou algum nome que o sistema real também usa?* Se sim, está em **Proibido**.

---

## 🔒 Proibido mudar (de forma alguma)

Se mudar, o desenho aprovado não dá para levar ao sistema real, ou ele perde função ou dado.

1. **Os dados de cada tela.** Mostre os campos que o sistema real entrega e só eles. Não invente campo que o servidor não manda (ex.: "último acesso", "empresa", "e-mail do contato") e não tire campo que existe. Antes de desenhar uma tela, leia o `.tsx` dela em `src/app/dashboard/<tela>/page.tsx` e liste os campos.
2. **As ações de cada tela.** Todo botão, campo e formulário que faz algo no sistema real continua existindo (enviar, anexar, responder, apagar, etiquetar, criar sessão, ler QR, importar...). Pode mudar onde fica, como parece e como se chama visualmente. Não pode sumir. Esconder dentro de um menu é permitido, desde que continue alcançável.
3. **Valores literais.** Status de sessão (`CONNECTED`, `SCAN_QR`...), status de mensagem (`PENDING`, `SENT`, `DELIVERED`, `READ`), tipos de mensagem (`TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `STICKER`, `DOCUMENT`), papéis (`SUPERADMIN`, `STAFF`, `USER`), filtros do chat (`all`, `private`, `groups`) e o formato de JID (`...@s.whatsapp.net` telefone, `@lid`, `@g.us` grupo, `@newsletter` canal). A tela pode mostrar um rótulo amigável, mas tem de existir um estado visual para cada valor.
4. **Telas, rotas e menu.** Os itens do menu e os caminhos (`/dashboard/...`, `/auth/login`) seguem os do sistema real. Não una nem tire telas por conta própria. Quem vê o quê (itens só para `SUPERADMIN`, como Usuários, Monitor do sistema e Notificações) continua igual.
5. **Tema.** O escuro é o padrão. A classe `dark` no `<html>` liga o modo escuro, e a preferência fica em `localStorage` na chave `vk-theme`. Os nomes das variáveis de cor (`--background`, `--primary`, `--sidebar`... e as `--wa-*` do chat) não mudam: os **valores** podem mudar.
6. **Idiomas.** O sistema tem pt-BR, en e id. A maquete mostra pt-BR. Texto mudado vai para o `SPEC-implementacao.md` para virar tradução nas três línguas depois; não deixe texto fixo que dependa de ser em português.
7. **Dados reais.** Nunca coloque contato, telefone, mensagem, foto ou nome de pessoa real em arquivo, captura ou fixture. Tudo é inventado.
8. **Onde mexer.** Só em `vk-fork-notes/design/`. Não edite `src/`, `prisma/` nem `docs/`. Não commite nem faça push: só o usuário pede.

## ⚠️ Pode, com cuidado (registre no `SPEC-implementacao.md`)

- **Algo novo que exige servidor**: filtro, ordenação, busca por outro campo, campo novo, tela nova. Pode desenhar, mas marque com o selo **"Novo"** na tela e liste no SPEC o que o backend precisaria. Sem isso, o desenho vira promessa que o sistema não cumpre.
- **Biblioteca ou componente que o React não tem pronto** (calendário, gráfico, editor): avise, porque vira pacote npm no sistema real.
- **Telas de chat (`chat-window`, `chat-list`)**: já foram alteradas no fork em relação ao upstream. Mudança grande de estrutura ali aumenta o risco de conflito quando o upstream atualizar. Prefira mexer no visual (classes) a reorganizar a estrutura.
- **Listas longas** (conversas, mensagens e contatos têm centenas ou milhares de itens): desenhe pensando em paginação ou rolagem, não em mostrar tudo de uma vez.
- **Acessibilidade**: não piore. `aria-label` em botão só de ícone, contraste, foco visível, `alt` em imagem, um `<h1>` por tela.
- **Estados**: vazio, carregando e erro existem no sistema real. Se desenhar, mantenha o mesmo significado.

## ✅ Livre (mexa à vontade)

Cores, tipografia, espaçamento, raios, sombras, animações, ícones, layout (grade, colunas, ordem visual, responsividade), aparência do menu, das bolhas do chat, de cartões, tabelas, formulários e modais, telas de login e cadastro (só o visual), ilustrações sem dados reais, e o desenho de estados vazio, carregando e erro.

---

## Como trabalhar

1. Comece pelo `Maquete Html-Tailwind/_modelo.html`: copie, renomeie e troque o conteúdo. Leia o `AGENTS.md` de lá (como o CSS funciona).
2. Confira em tela larga e em 390 px (celular), nos temas escuro e claro.
3. Valide: `node vk-fork-notes/design/ferramentas/validar-visual.mjs --pagina <telas separadas por vírgula>` (acrescente `--tema claro`). Precisa de Chrome e de `python3` com Pillow. Nunca use `--aceitar` sem pedido do usuário.
4. Atualize o `index.html` (tabela de telas) e o `SPEC-implementacao.md` a cada tela feita ou mudada.
