# just-llmprice Agent Rules

## Product Expression Guard

User-visible UI text must speak from the user's task, not from the implementation.

- Titles, card headings, buttons, tabs, navigation, and empty states should express user value or the next action.
- Implementation boundaries, source names, matching rules, fallbacks, debug notes, and data caveats belong in source chips, tooltips, footnotes, docs, or logs.
- Do not promote prompt constraints into user-facing headings. Words such as "not", "avoid", "only", "sample", "fallback", "debug", "matching key", and "TODO" are high risk in visible UI.
- Before finishing a UI change, run `npm run expression:lint` and inspect the rendered page for developer-note leakage.

Good:

```text
ChatGPT Plus 全球订阅低价榜
按实时汇率折算人民币，比较不同地区 Plus / Pro 月费。
```

Bad:

```text
Plus / Pro 月费单独看，不和 API token 价格混在一起。
```

