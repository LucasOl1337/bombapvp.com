# Decision 005 — kernel puro e scheduler estatico

## Decisao

`MechanicsProgram` e um valor puro e sem estado oculto:

```ts
interface MechanicsProgram {
  readonly mechanicsRevision: "mechanics-v1";
  readonly tickDurationMs: 20;
  initial(config: MatchConfig): WorldState;
  step(state: WorldState, input: StepInput): StepResult;
  snapshot(state: WorldState): GameSnapshot;
  restore(raw: unknown): WorldState;
}
```

Cada `step` executa exatamente um tick de 20 ms. Tempo de parede e restos de `deltaMs` pertencem aos adaptadores. O mundo e readonly, congelado e serializavel, sem `Map`, `Set`, funcoes ou clocks.

`initial(config)` valida a configuracao uma vez. `restore(raw)` valida profundamente a estrutura, verifica `WORLD_FORMAT_VERSION` e a revisao mecanica, e congela o resultado. Depois dessas fronteiras, `step` confia no estado e nao clona, serializa nem revalida o mundo inteiro.

## Composicao

Cada slice tem um unico modulo owner. Sistemas declaram fase, leituras e escritas. A compilacao rejeita IDs duplicados, ownership incompleto, writes estrangeiros e conflitos de escrita na mesma fase.

Fases sao barreiras explicitas. Sistemas da mesma fase leem o mesmo pre-state; fases posteriores observam os writes anteriores. A ordenacao deterministica independe da ordem de registro.

Ha tres linguagens distintas:

- **commands:** entradas ordenadas por tick, assento e sequencia;
- **facts:** dados tipados e efemeros entre fases do mesmo tick;
- **events:** saida observavel que nao dirige a simulacao.

## Revisao e formato

`mechanicsRevision` e manual: `mechanics-v1`. Ela muda somente quando regras executaveis mudam de forma incompatível. `WORLD_FORMAT_VERSION` permanece separado para compatibilidade estrutural de `restore`.

Versoes informativas de modulos nao formam identidade mecanica. Nao ha serializacao de descritores, fingerprints calculados nem validacao global no tick.

## Consequencias

Browser, replay, bots e servidor podem executar o mesmo programa. Novas abstracoes exigem mecanicas reais; o kernel nao inclui event bus, DI container ou DSL generica.