// Parâmetros da busca do ponto de inflexão; os valores monetários são hipotéticos.
export const PARAMETERS = Object.freeze({
  distances: [1, 5, 10, 50, 100],
  lower: 0,
  upper: 1000,
  fixed: 1000,
  trialsPerDistance: 6,
});

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export class BinarySearch {
  constructor(condition, distance, trialsPerDistance = PARAMETERS.trialsPerDistance, config = PARAMETERS) {
    if (!["Ganhar", "Pagar"].includes(condition)) throw new Error("Condição inválida");
    if (!Number.isInteger(trialsPerDistance) || trialsPerDistance < 1) throw new Error("Número de tentativas inválido");
    this.condition = condition;
    this.distance = distance;
    this.config = config;
    this.trialsPerDistance = trialsPerDistance;
    this.lower = config.lower;
    this.upper = config.upper;
    this.value = (this.lower + this.upper) / 2;
    this.trials = 0;
    this.done = false;
  }

  respond(choice) {
    if (this.done || !["self", "other"].includes(choice)) throw new Error("Resposta inválida para busca binária");
    const presented = this.value;
    const raisesLowerBound = (choice === "self") === (this.condition === "Pagar");
    if (raisesLowerBound) this.lower = presented;
    else this.upper = presented;
    this.trials++;
    this.done = this.trials >= this.trialsPerDistance;
    this.value = (this.lower + this.upper) / 2;
    return {
      presented,
      choice,
      lower: this.lower,
      upper: this.upper,
      estimate: this.value,
      done: this.done,
    };
  }

  summary() {
    return {
      trials: this.trials,
      lower: this.lower,
      upper: this.upper,
      estimate: this.value,
      complete: this.done,
    };
  }
}

export function csv(rows, columns) {
  const encode = value => {
    let text = String(value ?? "");
    // Evita execução de fórmulas quando o CSV é aberto em planilhas.
    if (typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\ufeff" + [columns, ...rows.map(row => columns.map(column => row[column] ?? ""))]
    .map(row => row.map(encode).join(",")).join("\r\n") + "\r\n";
}
