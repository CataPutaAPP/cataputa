# Service Connect Hub

Crie um app estilo marketplace de serviços (tipo Uber) com as seguintes especificações:

TELA INICIAL — Tela de boas-vindas com logo centralizado, dois botões: "Cadastro" e "Login", background com mapa estilizado placeholder.

CADASTRO — Passo 1: escolher perfil com 3 cards clicáveis ("Cliente", "Prestador", "Parceiro"). Passo 2: formulário com Nome completo, CPF (máscara + validação), Telefone (+55 com máscara), E-mail, Username (único), Senha + confirmação, badge do tipo de perfil. Ao finalizar: mensagem "Cadastro realizado! Link de confirmação enviado para seu e-mail." Conta inativa até confirmação.

LOGIN — Username + Senha, botão "Esqueci minha senha", redireciona para dashboard conforme tipo do usuário.

DASHBOARDS — Cliente: mapa fullscreen de fundo, botão flutuante "Solicitar Serviço", formulário (tipo, descrição, localização, urgência), lista de solicitações ativas. Prestador: mapa fullscreen, toggle "Disponível/Indisponível", feed de ofertas (aceitar/recusar), botão "Ofertar Serviço", lista de serviços em andamento. Parceiro: dashboard sem mapa, lista de negociações que optaram por parceiro, aceitar participação, status de parcerias.

DESIGN — Dark mode padrão, cores preto/branco/accent roxo-violeta, mobile-first responsivo, shadcn/ui.

TÉCNICO — React + TypeScript + Tailwind, preparar estrutura para Supabase (auth + database), types para User (role: 'cliente' | 'prestador' | 'parceiro'), ServiceRequest, ServiceOffer, Partnership, React Router, Context API para auth.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cataputa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1c89bb3f-02fb-4c1d-8be6-e4f0d97e65ef).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
