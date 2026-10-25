// Comportamento mínimo da maquete: só o que é preciso para VER as telas do sistema.
// Sem dados reais e sem rede. Carregue no <head>, antes do <body>, para o tema não piscar.
(function () {
  'use strict';

  var CHAVE_TEMA = 'vk-theme'; // mesma chave do src/lib/theme.ts (padrão: escuro)

  function ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
  function gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* sem armazenamento */ } }

  // Igual ao THEME_INIT_SCRIPT do sistema: só vira claro se a pessoa escolheu claro.
  var tema = ler(CHAVE_TEMA) === 'light' ? 'light' : 'dark';
  function aplicar() { document.documentElement.classList.toggle('dark', tema === 'dark'); }
  aplicar();

  document.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-tema-toggle]') : null;
    if (!alvo) return;
    tema = tema === 'dark' ? 'light' : 'dark';
    gravar(CHAVE_TEMA, tema);
    aplicar();
  });
})();
