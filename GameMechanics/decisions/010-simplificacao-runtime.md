# 010 - Simplificacao do runtime

Status: aceita

O novo `GameMechanics` sera um kernel deterministico com tick fixo de 20 ms.
A mesma entrada sobre o mesmo estado deve gerar o mesmo estado e os mesmos eventos.
A validacao profunda ocorre somente em `initial(config)` e `restore(raw)`.
Depois dessas fronteiras, o hot path confia no estado congelado e nos tipos do TypeScript.
A revisao mecanica manual e `mechanicsRevision = "mechanics-v1"`; `WORLD_FORMAT_VERSION` existe apenas para compatibilidade estrutural de restore.
Ela muda quando uma alteracao quebra a semantica de snapshots ou replays anteriores.
Nao usaremos FNV, fingerprint de topologia ou tabelas de versao por modulo.
Nao manteremos historico do mundo dentro do kernel.
Nao adotaremos gate scores nem rituais de promocao ou validacao.
Bots e adaptadores interagem com o kernel apenas por comandos, snapshots e eventos.
A fronteira atual e exatamente skills de `Champions` no novo runtime, bots, audio e adaptador online.
Qualquer ampliacao dessa fronteira exige uma decisao explicita posterior.
