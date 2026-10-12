# Definition of Done

A feature is not done because it worked once on the developer's machine.

## Feature

- [ ] Acceptance criteria documented and linked.
- [ ] Error and recovery states implemented.
- [ ] Critical logic has unit tests; interaction logic has replay tests where applicable.
- [ ] Relevant integration tests pass.
- [ ] Works in the **production build**, loaded unpacked.
- [ ] Permissions and privacy impact reviewed (no new permission without ADR update).
- [ ] UI states accessible and consistent with the design system.
- [ ] Performance measured where applicable.
- [ ] Docs updated if an architectural decision changed.

## MVP release

- [ ] Production-build installation succeeds on a clean Chrome profile.
- [ ] Complete YouTube workflow works end to end.
- [ ] Stop behavior verified (AC-6, AC-12).
- [ ] All acceptance criteria results recorded with test conditions.
- [ ] Privacy notice matches observed behavior.
- [ ] Known-issues list and release notes published.

## Kickoff checklist

**Product**

- [ ] MVP scope and exclusions frozen (PRD)
- [ ] Gestures and YouTube commands approved (ADR-004)
- [ ] Success criteria agreed (acceptance-criteria.md)
- [ ] Target laptop chosen

**Architecture**

- [ ] Camera execution context spike planned (ADR-001)
- [ ] State machines and message contracts reviewed
- [ ] Permission model and adapter boundary approved (ADR-005)

**Engineering**

- [ ] Repository and build pipeline created
- [ ] TypeScript strict, ESLint, Prettier, Vitest configured

**UX and QA**

- [ ] Camera and control states documented (interaction-specification.md)
- [ ] Tokens and core components approved (design-system.md)
- [ ] Scripted gesture and failure test plan agreed

**Delivery**

- [ ] Risk owners assigned
- [ ] Week 1 tasks and exit criteria created
- [ ] Definition of Done agreed
