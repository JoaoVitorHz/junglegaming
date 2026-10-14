# Lighthouse — resumo (medianas de 3 medições)

- Data: 2026-10-14T22:19:17.925Z
- Ferramentas: Lighthouse 13.5.0 · Chrome 155.0.0.0 · Node v24.11.0
- Máquina: Windows_NT 10.0.26200 (x64), AMD Ryzen 5 8500G w/ Radeon 740M Graphics       (12 núcleos), 30 GB
- Servidor: serve -s dist (build de produção, gzip) com VITE_ENABLE_MOCKS=true e cenário padrão dos mocks
- Mobile: Padrão do Lighthouse: Moto G Power emulado, throttling simulado (RTT 150 ms, 1,6 Mbps, CPU 4×)
- Desktop: Preset desktop do Lighthouse: 1350×940, RTT 40 ms, 10 Mbps, sem throttling de CPU

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | 80 | 100 | 100 | 100 | 4208 ms | 0.034 | 141 ms |
| inicio | desktop | 99 | 100 | 100 | 100 | 891 ms | 0.006 | 0 ms |
| detalhe | mobile | 82 | 100 | 100 | 100 | 4128 ms | 0.000 | 79 ms |
| detalhe | desktop | 99 | 100 | 100 | 100 | 906 ms | 0.000 | 0 ms |

Relatórios completos: `lighthouse/reports/<pagina>-<perfil>-run<n>.report.html|json`.
