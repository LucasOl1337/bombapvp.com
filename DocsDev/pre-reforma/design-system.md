# Sistema de interface

## Biblioteca de referencia

- Use o [Originkit](https://www.originkit.dev/) como catalogo de referencia para novas interfaces e refactors. Ele oferece componentes animados para React/Vite e consulta por MCP.
- Escolha componentes pelo problema de interface, nao apenas pelo efeito visual. Preserve a linguagem escura, tecnica e pixel-art do Bomba PvP.
- Antes de copiar codigo, confirme os termos/licenca do componente. A integracao MCP exige uma chave em `ORIGINKIT_API_KEY`; nunca grave essa chave no repositorio.
- Toda animacao precisa respeitar `prefers-reduced-motion`, manter contraste e nao competir com gameplay, leitura de dados ou input.

## Laboratorio de bots

O refactor da HUD de julho de 2026 combina tres referencias:

- [Originkit Pixel Card](https://www.originkit.dev/components/pixelcard): matriz de pixels sutil nos cards, com movimento reduzido acessivel.
- [LHM HUD management](https://lhm.gg/features/hud-management): separacao entre placar, identidade do competidor e dados ao vivo.
- [Serial Studio](https://github.com/Serial-Studio/Serial-Studio): telemetria organizada por widgets e modos de observacao.

No laboratorio, efeitos visuais ficam restritos a sinais de estado ao vivo e textura de baixa opacidade. Placar, nome, ultima acao e metricas continuam legiveis sem animacao.
