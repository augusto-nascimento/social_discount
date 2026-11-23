import { PARAMETERS as P, BinarySearch, shuffle, csv } from "./staircase.mjs";

const $ = id => document.getElementById(id);
const panel = $("panel");
const controls = $("trial-controls");
const toolbar = $("toolbar");
const startForm = $("start-form");
const columns = [
  "tipo_registro", "participante", "genero", "faixa_etaria", "crianca",
  "inicio_utc", "status_sessao", "fase",
  "ordem_blocos", "bloco", "condicao", "distancia", "ordem_distancia",
  "tentativa_global", "tentativa_celula", "valor_proprio", "valor_outro",
  "lado_valor_proprio", "opcao_esquerda", "opcao_direita", "escolha",
  "lado_escolhido", "resposta", "rt_ms", "limite_inferior",
  "limite_superior", "estimativa_ponto_inflexao", "tentativa_valida",
  "evento", "tentativas_descartadas", "celula_completa"
];

let psychoJS, visual, util, clock, stimuli, audioContext;
let participant = "", gender = "", ageGroup = "", isChild = "", startedAt = "", order = [], cells = new Map(), rows = [];
let current = null, ready = false, finished = false, blockIndex = 0, distanceIndex = 0;
let distances = [], globalTrial = 0;
const key = (condition, distance) => `${condition}:${distance}`;
const money = value => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", minimumFractionDigits: 2
}).format(value);
const baseRow = () => ({
  participante: participant, genero: gender, faixa_etaria: ageGroup, crianca: isChild,
  inicio_utc: startedAt, ordem_blocos: order.join("|")
});

function playDistanceSignal() {
  if (!audioContext || audioContext.state !== "running") return Promise.resolve();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 740;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  return new Promise(resolve => {
    oscillator.onended = resolve;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.23);
  });
}

function announceScreenChange() {
  playDistanceSignal().catch(error => {
    console.warn("Não foi possível reproduzir o sinal sonoro da mudança de tela:", error);
  });
}

function showPanel(html, buttons) {
  ready = false;
  controls.hidden = true;
  if (stimuli) Object.values(stimuli).forEach(stim => stim.setAutoDraw(false));
  panel.replaceChildren();
  const content = document.createElement("div");
  content.innerHTML = html;
  panel.append(content);
  for (const [label, handler] of buttons) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", handler);
    panel.append(button);
  }
  panel.hidden = false;
  announceScreenChange();
}

function download(status) {
  if (!participant) return;
  const summaries = [];
  for (const condition of order) {
    for (const distance of P.distances) {
      const cell = cells.get(key(condition, distance));
      const s = cell.summary();
      summaries.push({
        ...baseRow(), tipo_registro: "resumo", status_sessao: status, fase: "experimento",
        bloco: order.indexOf(condition) + 1, condicao: condition, distancia: distance,
        tentativa_celula: s.trials, limite_inferior: s.lower,
        limite_superior: s.upper, estimativa_ponto_inflexao: s.estimate,
        celula_completa: s.complete ? "sim" : "nao"
      });
    }
  }
  const file = new Blob([csv([...rows.map(r => ({ ...r, status_sessao: status })), ...summaries], columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `desconto_social_${participant}_${startedAt.replace(/[:.]/g, "-")}_${status}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function makeStimuli() {
  const common = { win: psychoJS.window, units: "norm", autoLog: false };
  const text = (name, pos, height, wrapWidth, bold = false) => new visual.TextStim({
    ...common, name, text: "", pos, height, wrapWidth, bold, color: new util.Color("#ffffff"), depth: -1
  });
  const rect = (name, x) => new visual.Rect({
    ...common, name, pos: [x, 0], width: 0.8, height: 0.6,
    lineWidth: 3, lineColor: new util.Color("#a8ccff"), fillColor: new util.Color("#223b58"), depth: 1
  });
  return {
    header: text("cabecalho", [0, 0.72], 0.06, 1.8, true),
    question: text("pergunta", [0, 0.45], 0.048, 1.8),
    leftBox: rect("caixa_esquerda", -0.5),
    rightBox: rect("caixa_direita", 0.5),
    leftText: text("texto_esquerda", [-0.5, 0], 0.065, 0.72, true),
    rightText: text("texto_direita", [0.5, 0], 0.065, 0.72, true),
    hint: text("instrucao_mouse", [0, -0.48], 0.05, 1.8),
    progress: text("progresso", [0, -0.72], 0.04, 1.8)
  };
}

function trial(cell, distanceOrder) {
  ready = false;
  panel.hidden = true;
  controls.hidden = false;
  $("reset-choice").hidden = false;
  const verb = cell.condition === "Pagar" ? "paga" : "ganha";
  const selfText = `Você ${verb}\n${money(cell.value)}`;
  const otherText = `Pessoa ${cell.distance} ${verb}\n${money(P.fixed)}`;
  current = { cell, distanceOrder, leftText: selfText, rightText: otherText };
  stimuli.header.setText(`${cell.condition.toUpperCase()}  |  Pessoa ${cell.distance}`);
  stimuli.question.setText("Qual opção você prefere?");
  stimuli.leftText.setText(current.leftText);
  stimuli.rightText.setText(current.rightText);
  stimuli.hint.setText("Clique na opção preferida");
  stimuli.progress.setText(`Bloco ${blockIndex + 1} de 2  |  Distância ${distanceIndex + 1} de 5  |  escolha ${cell.trials + 1} de ${P.trialsPerDistance}`);
  $("left-choice").setAttribute("aria-label", `Escolher: ${current.leftText.replace("\n", " ")}`);
  $("right-choice").setAttribute("aria-label", `Escolher: ${current.rightText.replace("\n", " ")}`);
  Object.values(stimuli).forEach(stim => stim.setAutoDraw(true));
  announceScreenChange();
  // A cena é desenhada no flip; só então iniciamos a medida e aceitamos resposta.
  psychoJS.window.callOnFlip(() => {
    if (current?.cell === cell && panel.hidden && !finished) {
      clock.reset();
      ready = true;
    }
  });
}

function respond(side, response) {
  if (!ready || !current || finished) return;
  ready = false;
  const rt = Math.max(0, Math.round(clock.getTime() * 1000));
  const t = current;
  const choice = side === "esquerda" ? "self" : "other";
  const result = t.cell.respond(choice);
  globalTrial++;
  rows.push({
    ...baseRow(), tipo_registro: "tentativa", fase: "experimento",
    bloco: blockIndex + 1,
    condicao: t.cell.condition, distancia: t.cell.distance,
    ordem_distancia: t.distanceOrder, tentativa_global: globalTrial,
    tentativa_celula: t.cell.trials, valor_proprio: result.presented, valor_outro: P.fixed,
    lado_valor_proprio: "esquerda",
    opcao_esquerda: t.leftText.replace("\n", " "), opcao_direita: t.rightText.replace("\n", " "),
    escolha: choice === "self" ? "proprio" : "outro", lado_escolhido: side, resposta: response,
    rt_ms: rt, limite_inferior: result.lower, limite_superior: result.upper,
    estimativa_ponto_inflexao: result.estimate, tentativa_valida: "sim"
  });
  if (result.done) {
    distanceIndex++;
    if (distanceIndex < distances.length) {
      beginDistance();
    }
    else if (blockIndex === 0) {
      blockIndex++;
      showPanel("<h2>Intervalo</h2><p>Descanse quanto precisar. O próximo bloco apresenta o outro tipo de decisão.</p>", [["Continuar", beginBlock]]);
    } else finish("completa");
  } else trial(t.cell, t.distanceOrder);
}

function beginBlock() {
  distanceIndex = 0;
  distances = [...P.distances];
  beginDistance();
}

function beginDistance() {
  const condition = order[blockIndex];
  const distance = distances[distanceIndex];
  const instruction = condition === "Ganhar"
    ? `Agora, imagine as seguintes escolhas entre uma quantia de dinheiro que você GANHARIA e a quantidade que a pessoa #${distance} na lista iria GANHAR. Nós estamos interessados em qual PESSOA você escolheria para RECEBER se essas escolhas fossem realmente oferecidas a você.`
    : `Agora, imagine as seguintes escolhas entre uma quantia de dinheiro que você PAGARIA e a quantidade que a pessoa #${distance} na lista iria PAGAR. Nós estamos interessados em qual PESSOA você escolheria para PAGAR se essas escolhas fossem realmente oferecidas a você.`;
  showPanel(`<h2>Bloco ${blockIndex + 1}: ${condition} — pessoa #${distance}</h2><p>${instruction}</p><p>A opção para você será sempre apresentada à esquerda. A cada distância, você fará seis escolhas com valores ajustados às suas respostas.</p><p>Se em algum momento você mudar de ideia sobre uma escolha, você pode recomeçar aquele conjunto de escolhas apertando o botão Reset na parte inferior direita da tela.</p>`, [
    ["Iniciar escolhas", () => trial(cells.get(key(condition, distance)), distanceIndex + 1)]
  ]);
}

function resetCurrentSet() {
  if (!ready || !current || finished) return;
  ready = false;
  const t = current;
  const block = blockIndex + 1;
  const discarded = rows.filter(row =>
    row.tipo_registro === "tentativa" &&
    row.tentativa_valida === "sim" &&
    row.fase === "experimento" &&
    row.bloco === block &&
    row.condicao === t.cell.condition &&
    row.distancia === t.cell.distance
  );
  for (const row of discarded) row.tentativa_valida = "nao";
  rows.push({
    ...baseRow(), tipo_registro: "evento", fase: "experimento", bloco: block,
    condicao: t.cell.condition, distancia: t.cell.distance,
    ordem_distancia: t.distanceOrder, tentativa_celula: t.cell.trials,
    evento: "reset", tentativas_descartadas: discarded.length
  });
  const restarted = new BinarySearch(t.cell.condition, t.cell.distance);
  cells.set(key(t.cell.condition, t.cell.distance), restarted);
  trial(restarted, t.distanceOrder);
}

function finish(status) {
  ready = false;
  finished = true;
  toolbar.hidden = true;
  download(status);
  showPanel(`<h2>${status === "completa" ? "Experimento concluído" : "Experimento encerrado"}</h2>
    <p>O navegador tentou baixar um arquivo CSV ${status === "completa" ? "completo" : "parcial"}. Se o download não começou, use o botão abaixo.</p>
    <p>Os dados não foram enviados ao pesquisador. Guarde ou compartilhe o arquivo conforme as orientações recebidas.</p>`, [
    ["Baixar CSV novamente", () => download(status)]
  ]);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

async function start(event) {
  event.preventDefault();
  if (!startForm.reportValidity()) return;
  const entered = $("participant").value.trim();
  const selectedGender = $("gender").value;
  const selectedAgeGroup = $("age-group").value;
  const selectedIsChild = $("is-child").value;
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(entered)) return;
  $("start").disabled = true;
  const fullscreen = document.documentElement.requestFullscreen
    ? document.documentElement.requestFullscreen().then(() => true, () => false)
    : Promise.resolve(false);
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      audioContext.resume().catch(error => console.warn("Áudio de transição indisponível:", error));
    }
    const modules = await import("https://lib.pavlovia.org/psychojs-2024.2.4.js");
    visual = modules.visual;
    util = modules.util;
    psychoJS = new modules.core.PsychoJS({ debug: false, collectIP: false, saveResults: false });
    psychoJS.openWindow({ fullscr: false, color: new util.Color("#101927"), units: "norm", autoLog: false });
    clock = new util.Clock();
    stimuli = makeStimuli();
    psychoJS.schedule(() => util.Scheduler.Event.FLIP_REPEAT);
    psychoJS.scheduler.start();
    participant = entered;
    gender = selectedGender;
    ageGroup = selectedAgeGroup;
    isChild = selectedIsChild;
    startedAt = new Date().toISOString();
    order = shuffle(["Ganhar", "Pagar"]);
    for (const condition of order) for (const distance of P.distances) cells.set(key(condition, distance), new BinarySearch(condition, distance));
    toolbar.hidden = false;
    const fullscreenOk = await fullscreen;
    showPanel(`<h2>Instruções</h2>
      ${fullscreenOk ? "" : "<p class='error'>Não foi possível ativar a tela cheia. Você pode continuar em janela.</p>"}
      <p>O programa a seguir pede para você imaginar que fez uma lista das 100 pessoas mais próximas de você, indo desde o seu amigo ou familiar mais querido na posição #1 a um mero conhecido na posição 100#. A pessoa de número 1 seria alguém que você conhece bem, seu amigo ou familiar mais próximo. A pessoa na posição 100# pode ser alguém que você reconhece e encontra, mas talvez você nem saiba o nome dela. Você não precisa criar a lista fisicamente, mas apenas imaginar que o fez.</p>
      <p>Os valores são hipotéticos. A opção com o seu valor estará sempre à esquerda e a opção da pessoa da lista à direita. Em cada distância, o valor pessoal começa em R$ 500 e é ajustado por busca binária em relação a R$ 1000. São seis escolhas por distância.</p>
      <p>Você pode baixar um CSV parcial ou encerrar pelo menu superior. Fechar a página sem baixar pode perder os dados.</p>`, [
      ["Começar experimento", beginBlock]
    ]);
  } catch (error) {
    console.error("Não foi possível iniciar o experimento:", error);
    $("load-error").hidden = false;
    $("load-error").textContent = "Não foi possível carregar ou iniciar o PsychoJS. Verifique a conexão e o suporte a WebGL, e recarregue a página.";
    $("start").disabled = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
}

startForm.addEventListener("submit", start);
$("left-choice").addEventListener("click", () => respond("esquerda", "clique"));
$("right-choice").addEventListener("click", () => respond("direita", "clique"));
$("reset-choice").addEventListener("click", resetCurrentSet);
$("save").addEventListener("click", () => download("parcial"));
$("stop").addEventListener("click", () => {
  if (window.confirm("Encerrar agora? Um CSV parcial será baixado.")) finish("interrompida");
});
if (startForm) $("start").disabled = false;
window.addEventListener("beforeunload", event => {
  if (participant && !finished) {
    event.preventDefault();
    event.returnValue = "";
  }
});
