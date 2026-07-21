# Ranni

- Identidade e cooldown: `definition.ts`
- Ice Blink, projeção e egress de bombas: `skill.ts`
- Feedback bloqueado, preview e animação: `visuals.ts`
- Retrato e 147 sprites: `assets/`

## Leitura visual do Ice Blink

- o corpo fisico sustenta o frame de prisao de gelo na origem;
- `skill.projection` e desenhada como uma Ranni espectral em movimento;
- a janela de 2,5 segundos controla a projecao a metade da velocidade normal; um segundo `R` conclui antes;
- a projecao atravessa terreno, mas o ponto final ainda precisa ser valido;
- a pose congelada e o espirito existem somente durante `channeling`.

O engine acessa essas regras somente pelos adapters genéricos de `Champions/runtime.ts` e `Champions/visual-runtime.ts`.
