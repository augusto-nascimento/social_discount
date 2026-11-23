import test from "node:test";
import assert from "node:assert/strict";
import { PARAMETERS, BinarySearch, shuffle, csv } from "./staircase.mjs";

test("busca binária atualiza o intervalo conforme as escolhas", () => {
  const search = new BinarySearch("Ganhar", 1);
  assert.equal(search.value, 500);
  const choseSelf = search.respond("self");
  assert.deepEqual([choseSelf.lower, choseSelf.upper, choseSelf.estimate], [0, 500, 250]);
  const choseOther = search.respond("other");
  assert.deepEqual([choseOther.lower, choseOther.upper, choseOther.estimate], [250, 500, 375]);
  assert.equal(choseOther.done, false);
});

test("Pagar usa busca binária inversa", () => {
  const choosePayment = new BinarySearch("Pagar", 1);
  const paysSelf = choosePayment.respond("self");
  assert.deepEqual([paysSelf.lower, paysSelf.upper, paysSelf.estimate], [500, 1000, 750]);

  const chooseOtherPayment = new BinarySearch("Pagar", 1);
  const otherPays = chooseOtherPayment.respond("other");
  assert.deepEqual([otherPays.lower, otherPays.upper, otherPays.estimate], [0, 500, 250]);
});

test("executa seis tentativas por distância e estima o ponto de inflexão", () => {
  const search = new BinarySearch("Ganhar", 5);
  const offered = [];
  for (let i = 0; i < PARAMETERS.trialsPerDistance; i++) {
    offered.push(search.value);
    search.respond(i < 3 ? "self" : "other");
  }
  assert.deepEqual(offered, [500, 250, 125, 62.5, 93.75, 109.375]);
  assert.equal(search.done, true);
  assert.equal(search.trials, 6);
  assert.equal(search.summary().estimate, 117.1875);
  assert.throws(() => search.respond("self"));
});

test("buscas por condição e distância são independentes", () => {
  const receive = new BinarySearch("Ganhar", 1);
  const gain = new BinarySearch("Ganhar", 1);
  const otherDistance = new BinarySearch("Pagar", 5);
  receive.respond("self");
  assert.equal(gain.value, 500);
  assert.equal(otherDistance.value, 500);
  assert.throws(() => new BinarySearch("Receber", 1));
});

test("CSV escapa valores perigosos e embaralhamento preserva os itens", () => {
  assert.deepEqual(shuffle([1, 5, 10, 50, 100], () => 0).sort((a, b) => a - b), PARAMETERS.distances);
  assert.equal(csv([{ a: '=2+2', b: 'a,"b"', c: -1 }], ["a", "b", "c"]), '\ufeff"a","b","c"\r\n"\'=2+2","a,""b""","-1"\r\n');
});
