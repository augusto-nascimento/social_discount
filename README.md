# Desconto social

Experimento hipotético em português, implementado com PsychoJS 2024.2.4 e arquivos estáticos. Abra `index.html` por HTTP(S), em um navegador atualizado com JavaScript e WebGL; as bibliotecas PsychoJS e PreloadJS são carregadas de `lib.pavlovia.org` e `code.createjs.com`, portanto é necessária conexão à internet. Para testar, sirva esta pasta com qualquer servidor HTTP estático; por exemplo, `npx serve .`. Não é necessário Python nem compilação.

Este experimento foi baseado no trabalho, ainda em andamento, do professor Fábio Leyser Gonçalves, do Departamento de Psicologia da Unesp Bauru.

## GitHub Pages

O repositório publica automaticamente este experimento pelo GitHub Pages sempre que há atualização na branch `main`, usando o workflow em `.github/workflows/pages.yml`. A página pública fica em <https://augusto-nascimento.github.io/social_discount/>. O primeiro deploy pode levar alguns minutos para ficar disponível. Se o Pages ainda não tiver sido ativado para o repositório, confira **Settings → Pages** e selecione **GitHub Actions** como origem.

Também pode hospedar estes arquivos em qualquer servidor estático. Uma implantação no Pavlovia pode servir os mesmos arquivos, mas **esta implementação não usa o upload nativo do Pavlovia**.

## Dados e privacidade

Não há endpoint de upload: ao finalizar ou encerrar pelo botão, o navegador tenta baixar um CSV. O participante também pode baixar dados parciais durante a sessão ou repetir o download na tela final. O arquivo fica no dispositivo e deve ser entregue ao pesquisador por um canal combinado separadamente; hospedagem estática não recebe os dados. Downloads podem ser bloqueados pelo navegador. Fechar, recarregar ou perder a página antes de salvar pode perder os dados; o aviso ao sair não substitui o download. Não há recuperação automática após fechamento.

Use um código de participante pseudônimo, sem nome. O formulário coleta gênero (incluindo a opção de não informar), faixa etária (abaixo ou acima de 25 anos) e se a pessoa é criança; esses campos são incluídos no CSV local. Não são solicitados nomes para a lista imaginada. Não há coleta intencional de IP pelo código; o servidor de hospedagem e os serviços que fornecem as bibliotecas podem manter seus próprios registros de acesso.

## Procedimento e CSV

O participante imagina uma lista das 100 pessoas mais próximas, da posição #1 (amigo ou familiar mais próximo) à posição 100# (alguém conhecido, mesmo que não saiba seu nome); não precisa escrever a lista. Em **Ganhar**, compara uma quantia que ganharia com a que a pessoa #N ganharia, considerando qual pessoa escolheria para receber. Em **Pagar**, compara quanto pagaria com quanto a pessoa #N pagaria, considerando qual pessoa escolheria para pagar. Os cenários são hipotéticos. A opção pessoal fica sempre à esquerda e a opção da pessoa indicada à direita. Todas as respostas são por clique; não há respostas por teclado.

Não há teste/prática inicial. A ordem dos blocos (Ganhar/Pagar) é sorteada para cada sessão, portanto o contrabalanceamento é esperado na amostra, mas não garante igualdade exata. No início de cada distância é apresentada a instrução correspondente, com `N` substituído pela posição da pessoa. Em cada bloco, as cinco distâncias são apresentadas em ordem crescente (1, 5, 10, 50, 100), e cada distância é concluída antes da próxima. Um sinal sonoro breve toca a cada mudança de tela, incluindo instruções, escolhas, intervalo e telas finais. O RT em milissegundos é medido do primeiro flip da cena até o clique.

Durante uma série de escolhas, o botão **Reset**, no canto inferior direito, reinicia as seis escolhas daquela condição e distância. As tentativas anteriores são mantidas no CSV para auditoria, mas marcadas como inválidas; o evento de reset e a quantidade descartada também são registrados.

Cada condição × distância tem uma busca binária independente, com seis escolhas. O valor pessoal começa em R$ 500, comparado a R$ 1000 para a outra pessoa. Em Ganhar, escolher o valor pessoal reduz a faixa de busca (a próxima oferta é R$ 250); escolher a outra pessoa eleva o limite inferior. Em Pagar, a atualização é inversa: escolher pagar o valor pessoal eleva o limite inferior (a próxima oferta é R$ 750); escolher que a outra pessoa pague reduz o limite superior (a próxima oferta é R$ 250). A próxima oferta é sempre o ponto médio dos limites atualizados. Após seis escolhas, o ponto médio final é a estimativa do ponto de inflexão. Os limites e a quantidade de tentativas estão definidos em `staircase.mjs`.

O CSV contém linhas `tentativa`, eventos `reset` e dez linhas `resumo`, inclusive células ainda não iniciadas em downloads parciais. Registra código pseudônimo, gênero, faixa etária, indicador de criança, ordem dos blocos e distâncias, condição, valores/opções, lados, escolha, RT, limites da busca, estimativa do ponto de inflexão e validade da tentativa. `status_sessao` distingue download parcial, encerramento e conclusão. O separador é vírgula e a codificação é UTF-8 com BOM.

Para verificar a lógica, execute `node --test staircase.test.mjs` e `node --check experiment.mjs`.
