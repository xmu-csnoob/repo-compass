# Design Phase Kanban

This Kanban translates the design-phase whitepaper into an executable planning
track before the next implementation phase starts.

## Milestones

- `D0`: problem statement and scope freeze
- `D1`: contract and artifact freeze
- `D2`: risk review and validation plan complete
- `D3`: implementation-ready backlog complete

## Backlog

### Epic D0: Problem Definition

- [ ] `D0.1` Define target user and primary usage scenario
- [ ] `D0.2` Document the pain point left unsolved by Phase 1
- [ ] `D0.3` Define success metrics for the next phase
- [ ] `D0.4` Freeze in-scope, out-of-scope, and stretch goals

### Epic D1: Contract Design

- [ ] `D1.1` Define the next-phase canonical model
- [ ] `D1.2` Define compatibility rules with Phase 1 artifacts
- [ ] `D1.3` Freeze artifact list and required backing fields
- [ ] `D1.4` Define module boundaries and ownership seams

### Epic D2: Validation And Risk

- [ ] `D2.1` Build a risk register with exit criteria
- [ ] `D2.2` Decide which risks need spikes instead of prose
- [ ] `D2.3` Define the regression and compatibility test strategy
- [ ] `D2.4` Define performance and determinism gates

### Epic D3: Execution Readiness

- [ ] `D3.1` Break work into epics with milestone alignment
- [ ] `D3.2` Assign recommended owners by coupling level
- [ ] `D3.3` Define implementation review gates
- [ ] `D3.4` Freeze the definition of done for the next build phase

## Definition Of Done

The design phase is done only when all of the following are true:

- foundation, contracts, artifact spec, repo structure, and kanban documents
  exist
- if repo-specific filenames are used, the document-role mapping is explicit
- document set is internally consistent
- open risks have owners and exit criteria
- implementation backlog can start without reopening scope debates
- compatibility expectations with Phase 1 are documented
