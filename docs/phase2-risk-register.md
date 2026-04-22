# Phase 2 Risk Register

## 1. Top Risks

### R1. Framework Support Expands Noise Faster Than Value

Risk:

- adding framework-specific heuristics may increase false positives and ranking
  instability

Exit criterion:

- fixture-based precision improves on targeted frameworks without increased
  noise on existing Phase 1 fixtures

### R2. Incremental Analysis Breaks Determinism

Risk:

- incremental mode may diverge from full-scan results for the same snapshot

Exit criterion:

- explicit equivalence tests pass for representative fixture deltas

### R3. Schema Growth Becomes Uncontrolled

Risk:

- Phase 2 may accumulate ad hoc fields with unclear ownership and weak consumer
  semantics

Exit criterion:

- every new field has a named consumer, evidence rule, and compatibility note

### R4. Derived Views Drift Away From Canonical Truth

Risk:

- richer markdown or agent views may add unsupported interpretation

Exit criterion:

- backing-field coverage and snapshot assertions prevent unsupported claims

### R5. Fixture Suite Stops Representing Real Repos

Risk:

- synthetic fixtures may overfit heuristics and hide practical failure modes

Exit criterion:

- Phase 2 fixture strategy includes both synthetic and production-style shapes

## 2. Risk Handling Policy

- resolve correctness risks before ergonomics risks
- resolve compatibility risks before optional artifacts
- do not ship incremental mode under ambiguous equivalence semantics
