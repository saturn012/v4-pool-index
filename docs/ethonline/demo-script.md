# ETHOnline 2026 — альтернативный сценарий демо

Ролик строится вокруг одного реального пула: какой вердикт он получил, на чём этот вердикт основан и как агент за него заплатил.

Около 380 слов озвучки. Ориентир — 3:30 с паузами. Озвучка на английском, инструкции для записи на русском. Основные кадры — настоящий вывод, код и обозреватель.

## 0:00–0:20 · Сразу показать результат

На экране крупно: реальный `REJECT` и причины из шага 3. Этот первый кадр можно взять из того же записанного прогона и поставить перед запуском команды.

> An agent can identify these tokens and still know almost nothing about how a swap will behave.
>
> v4-pool-index turns that gap into an explicit assessment.
>
> For this real pool on Base, the result is REJECT. Every check comes with a reason.

## 0:20–0:45 · Запустить демонстрацию

Терминал. Нажать Enter на `npm run demo`. Пока команда работает, говорить поверх. После завершения перейти к вердикту.

> This command retrieves the pool’s identity through a live Substreams provider, adds token metadata from Pinax, and applies deterministic checks.
>
> The output includes a verdict, a reason for each check, and the sources behind it.
>
> Let’s look at what the result actually means.

## 0:45–1:25 · Объяснить три строки

Крупно показать вывод. Последовательно выделять `hooks`, `fee`, `volume`. После каждой причины оставлять небольшую паузу.

> The hook address is non-zero. Initialize tells us which hook is attached, but not what its callbacks will do.
>
> Our policy rejects that unresolved behavior; it does not label the hook malicious.
>
> The raw fee contains a dynamic-fee flag. We keep the effective fee unknown.
>
> And the metadata source has no volume field. That becomes UNKNOWN, not zero volume.
>
> Even a PASS is limited to these checks. It is not proof of liquidity or a successful buy and sell.

## 1:25–2:00 · Показать, что другие разработчики могут использовать

Открыть две страницы пакетов: producer `v0.1.2` и consumer `v0.1.1`. Затем — строку `imports` в `consumer/substreams.yaml`. На последних предложениях показать BSC-раздел README с числами сверки.

> The reusable part is the typed identity stream.
>
> Here are two published Substreams packages. The consumer imports the producer by registry name and adds pool counts and flags without copying the event decoder.
>
> We also tested the local producer on BSC: one manifest entry, zero Rust changes.
>
> Over two hundred blocks, its two events matched the node’s two logs.
>
> The published package versions still cover Base and Robinhood.

## 2:00–2:45 · Показать оплату и полученный ответ

Вернуться к выводу того же прогона: сначала `HTTP 402`, затем `HTTP 200`. Скопировать хеш, открыть транзакцию в Base Sepolia, показать успешный статус. Вернуться к телу ответа с вердиктом.

> The assessment is available through MCP and a paid HTTP endpoint. This HTTP demo runs locally.
>
> The first request receives HTTP 402.
>
> The payer authorizes zero point zero zero one test USDC. The facilitator settles it and pays the gas.
>
> We then receive HTTP 200, the assessment, and a transaction hash we can verify on Base Sepolia.
>
> The customer needs no service API key. The backend still uses its provider credentials.

Здесь стоит выдержать паузу на успешной транзакции: зритель должен успеть увидеть подтверждение.

## 2:45–3:15 · Объяснить связь с существующим продуктом

На экране — репозиторий и история коммитов. Затем раздел README с раскрытием использования AI.

> This is a new component for AlphaScanner, my existing Telegram signal and BNB Chain execution product.
>
> Those systems predate the hackathon and remain outside this submission.
>
> The new assessment code is public; integration with the product is still unfinished.
>
> AI tools assisted implementation and testing; the disclosure is in the README.
>
> The planned integration point is a check before execution.

## 3:15–3:30 · Закончить на проверяемом результате

Вернуться к исходному вердикту. В кадре оставить причины и границы проверки. После последней фразы — две секунды тишины.

> You can pull the packages, inspect the rules, and verify the payment.
>
> Every verdict shows its evidence—and the questions still unanswered.

## Примечание для записи

Перед записью проверь готовность своего окружения. Если используешь сохранённый прогон от 11 сентября, подпиши его **“Recorded run — September 11, 2026”** и показывай соответствующий ему хеш. Таймкоды здесь — ориентиры для репетиции; сокращать лучше текст или переходы между кадрами.
