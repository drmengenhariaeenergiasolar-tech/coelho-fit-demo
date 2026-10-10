# CoelhoFit — demonstração

Demonstração independente para PC e celular. Funções ativas: clientes, fornecedores, produtos e orçamentos com PDF personalizado. Pedidos, estoque e caixa têm somente prévias com campos desativados.

Os dados de teste são gravados apenas no navegador do visitante. Não há API, banco compartilhado, autenticação ou conexão com o DRM Operacional. Os produtos iniciais e preços são exemplos ilustrativos.

## Publicar no GitHub Pages

O diretório `docs/` contém a versão compilada. Em Settings → Pages, selecione Deploy from a branch, branch `main`, pasta `/docs` e salve.

## Atualizar

Instale as dependências com `npm install`, execute `npm run typecheck` e `npm run build`, substitua o conteúdo de `docs/` pelo de `dist/` e adicione `.nojekyll` a `docs/`.

As bibliotecas vendorizadas e seus avisos de licença ficam em `public/vendor/`.
