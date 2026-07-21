# Geracao consistente de sprites

LEIA ANTES de gerar, regenerar ou integrar arte raster de Champion com IA.
Este pipeline e uma tecnica central do Bomba PvP. Ele existe para preservar a
identidade dos personagens e impedir que folhas brutas, variantes descartadas e
arquivos gigantes entrem no runtime ou no repositorio.

## Principio

O modelo de imagem cria keyframes e materia-prima. Ele nao decide sozinho
timing, colisao, ancora, recorte ou integracao. A engine continua sendo a fonte
de verdade para a duracao e o estado da habilidade.

Sempre prefira reutilizar um sprite aprovado com tratamento no canvas quando a
mudanca for apenas aura, fantasma, brilho, sombra ou cor. Gere pixels novos
somente quando a silhueta ou a pose realmente precisar mudar.

## Pacote de referencias

Use um conjunto pequeno e explicito:

1. retrato aprovado, para identidade;
2. sprite estatico da direcao desejada, para escala e ancora;
3. primeiro e ultimo frame de uma animacao aprovada, para linguagem corporal;
4. grid vazio no tamanho final, quando a geometria das celulas for critica.

Rotule no prompt a funcao de cada imagem. Nao misture referencias de personagens
diferentes nem use dezenas de imagens redundantes.

## Prompt de folha

Declare sempre:

- quantidade exata de linhas, colunas e frames;
- ordem narrativa de cada celula;
- uma figura por celula, sem atravessar divisorias;
- mesma escala, perspectiva, iluminacao e paleta;
- pes na mesma ancora e silhueta legivel;
- fundo chroma solido `#ff00ff` para personagens azuis ou verdes;
- sem texto, sombra de contato, watermark ou elementos fora do grid.

Para animacoes, descreva keyframes concretos. Exemplo: preparacao, antecipacao,
impacto, pose sustentada, ruptura e recuperacao. Nao use apenas "faça uma
animacao suave".

## Pos-processamento obrigatorio

1. Remova o chroma com matte suave e despill.
2. Corte as celulas pela geometria exata do grid, nunca por deteccao subjetiva.
3. Normalize canvas, escala e ancora dos pes.
4. Reduza para a resolucao final antes de integrar.
5. Quando o estilo exigir pixel art rigida, limite a paleta e use
   nearest-neighbor no redimensionamento.
6. Valide canal alpha, cantos transparentes e ausencia de halo.
7. Exporte apenas os frames finais em `Champions/<slug>/assets/animations/`.

Folhas brutas, previews, prompts temporarios e variantes rejeitadas ficam fora
do repositorio. Nao duplique um efeito que possa ser produzido no canvas usando
os sprites aprovados.

## Integracao dirigida pelo estado

O tempo visual deve vir do estado real da habilidade. Uma pose sustentada deve
ser mantida enquanto o kernel estiver naquele estado, em vez de repartir os
frames igualmente por uma duracao inventada pelo renderer. Se a habilidade
terminar cedo, a apresentacao tambem termina cedo.

Separe entidades visuais quando a fantasia separar entidades logicas. No Ice
Blink da Ranni, por exemplo, o corpo fisico fica congelado e uma segunda
renderizacao espectral acompanha `skill.projection`; animar o corpo inteiro como
se ele estivesse andando comunica uma regra errada.

## Checklist antes de aceitar

- identidade reconhecivel ao lado do sprite estatico aprovado;
- nenhuma celula muda de escala ou ancora;
- preview da sequencia no tempo real da habilidade;
- teste cobrindo estado inicial, pose sustentada e termino antecipado;
- teste do contrato mecanico quando o visual depende de projecao ou colisao;
- build sem importar folhas brutas;
- tamanho final medido e justificado.
