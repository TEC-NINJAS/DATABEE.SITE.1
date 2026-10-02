# DataBee — primeira versão

Site responsivo em **JavaScript**, com **React + Ionic + Capacitor** e servidor **Node.js**. Uma base web reutilizável para um futuro aplicativo Android/iOS.

## Abrir no VS Code

1. Instale **Node.js 22 ou 24 LTS** pelo site oficial https://nodejs.org.
2. Extraia o ZIP e abra a pasta `DATABEE.SITE.1` no VS Code. A pasta aberta deve conter `package.json`.
3. Abra **Terminal → Novo terminal** e execute:

```sh
npm ci
npm run dev
```

4. No seu computador, abra **http://localhost:5173** no navegador. Mantenha o terminal aberto. Use `Ctrl+C` para encerrar.

O comando inicia a interface (porta 5173) e a API (porta 3001). Não é necessário configurar banco, conta ou chave para experimentar. Na primeira publicação, a pasta `data/` será criada automaticamente.

Se a porta estiver ocupada, encerre a outra aplicação. Em Windows, se o PowerShell bloquear `npm.ps1`, use o terminal **Command Prompt** do VS Code ou execute `npm.cmd ci` e `npm.cmd run dev`.

## O que funciona

- Página inicial responsiva, com indicadores calculados a partir dos registros reais.
- Catálogo inicial de quatro táxons, busca sem distinção de acentos, filtros e fichas informativas.
- Registro com foto JPG/PNG/WebP, título, cidade, notas e identificação opcional do observador.
- Redimensionamento de imagens e remoção dos metadados EXIF pelo navegador.
- Geolocalização opcional: coordenadas arredondadas a 0,1° antes do envio e novamente no servidor. Aproximadamente 11 km na latitude; a distância na longitude varia.
- Feed, detalhes, comentários e mapa interativo com OpenStreetMap.
- Persistência dos registros e comentários em `data/observations.json`, mesmo após reiniciar a API.
- Estados de carregamento, erros, validação de campos e limite de upload.

### Primeiro teste manual

1. Abra o catálogo, busque `jatai` e consulte a ficha da Jataí.
2. Clique em **Registrar abelha**, escolha uma foto e preencha nome, título e cidade.
3. Se quiser um ponto no mapa, permita a localização. Ela requer permissão e contexto seguro (HTTPS ou localhost). É possível publicar sem GPS.
4. Publique, abra a observação e faça um comentário.
5. Recarregue a página e confirme que os dados continuam disponíveis.
6. Acesse o mapa e clique no ponto ou no botão do registro, quando houver localização.

## Verificações e versão compilada

```sh
npm test
npm run build
npm start
```

Com `npm start`, o mesmo servidor entrega a interface compilada e a API em **http://localhost:3001**. Encerre `npm run dev` antes para liberar a porta. Execute `npm run build` novamente após editar a interface.

## Estrutura

```text
src/main.jsx             Interface e fluxos
src/styles.css           Estilo responsivo
src/catalog.js           Catálogo introdutório
server/index.js          API e armazenamento local
tests/api.test.js        Validação, persistência e privacidade
vite.config.js           Build e proxy de desenvolvimento
capacitor.config.json    Configuração do futuro app
.env.example             Configuração opcional, sem segredos
package-lock.json        Versões reproduzíveis das dependências
```

## Preparar Android / iOS futuramente

O Capacitor já está configurado e os pacotes estão instalados. Os projetos nativos ainda não foram gerados nem testados nesta entrega. O aplicativo embute a interface, mas **não embute o servidor Node.js**: será necessário hospedar a API em HTTPS.

1. Hospede a API com armazenamento persistente. Configure `ALLOWED_ORIGINS` no servidor para o endereço real do site, se usar domínios separados. Não coloque segredos em variáveis `VITE_`.
2. Copie `.env.example` para `.env.local` e defina `VITE_API_URL=https://endereco-da-sua-api` (sem `/api` no final).
3. Instale Android Studio e seu SDK para Android. Para iOS, use macOS com Xcode.
4. Execute para Android:

```sh
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Para iOS, substitua `android` por `ios`. Use `cap add` apenas na primeira criação da plataforma. Após alterações, execute `npm run app:sync`.

Antes de distribuir, integre os plugins nativos de câmera e localização, configure permissões e textos explicativos, teste em dispositivos físicos e prepare assinatura e publicação nas lojas. Nesta primeira versão, a foto e o GPS usam as APIs do navegador; o comportamento em WebView precisa ser validado. Ainda não há service worker, instalação PWA completa ou funcionamento offline.

## Limites desta primeira versão

Este é um **protótipo local**, não uma plataforma de produção. Não há contas, autenticação, autorização, moderação, recuperação de senha, validação por especialistas ou IA integrada. Os nomes são livres; o indicador de observadores conta nomes distintos, não pessoas verificadas. As sugestões nunca são apresentadas como identificações confirmadas.

A IA deverá ser chamada exclusivamente pelo servidor, com credenciais seguras, permitindo resposta inconclusiva e identificação por gênero ou família. Não há porcentagens de confiança inventadas.

Antes de publicar para usuários reais, implemente autenticação, controle de acesso, limites de requisições, moderação, política de privacidade, exclusão de dados, armazenamento de fotos apropriado, banco PostgreSQL, backups e revisão científica das fichas. O JSON atual serve para um processo local e poucos registros, não para múltiplos servidores ou um grande catálogo. Todos os registros são compartilhados entre quem acessa esta instância.

O mapa precisa de internet e utiliza tiles públicos do OpenStreetMap, com atribuição visível. Para tráfego de produção, selecione um provedor e siga sua política de uso: https://operations.osmfoundation.org/policies/tiles/. As fontes do Google são opcionais: o site usa fontes locais de fallback se estiver offline.

O documento HTML fornecido contém o índice e o texto apenas até o início da seção 3. Esta implementação segue os pilares legíveis (registro, localização, catálogo e colaboração) e as necessidades descritas na conversa. Não afirma implementar todas as seções ausentes.

## Ambiente na nuvem

Use o checkout existente; cada tarefa já está isolada. Não crie worktrees sem pedido explícito. Instale com `npm ci`; inicie com `npm run dev`; valide com `npm test`, `npm run build` e requests locais. Processos precisam ser reiniciados em novas tarefas. Os dados locais ficam em `data/`; não versione fotos ou dados pessoais.
