# Model System

Location: `apps/crawler/src/model/`

## Three Composable Primitives

- **Scalar**: `string | number | boolean | enum` — merge = latest wins
- **Composite**: struct of named fields (each a Model) — merge = recursive per-field
- **Collection**: `Map<string, Model>` with composite key function — merge = union by key, recursive merge on value collision

## Serialization

- Collections with no nested collections → single `{name}.jsonl`
- Nested collections → normalized into separate JSONL files joined by foreign keys (RDB-style)
- Each JSON line has deterministically sorted keys
- Lines sorted by composite key, elementwise (number=numeric, string=alphabetical)
- Valibot validates on deserialization

## Files

- `types.ts` — `ScalarModel`, `CompositeModel`, `CollectionModel`, `Infer<M>`
- `builders.ts` — `scalar.string()/.number()/.boolean()/.enum()`, `composite()`, `collection()`
- `merge.ts` — `merge(model, left, right)` recursive merge
- `serialize.ts` — `serialize(model, data, name)` → sorted JSONL with normalization
- `deserialize.ts` — `deserialize(model, files, name)` → typed data with validation
