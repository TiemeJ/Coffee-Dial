Stage 4 Step 9 post-scan:

Resolved:
- Added enforceable feature-boundary script:
  - `scripts/check-feature-boundaries.mjs`
- Added contract-level enforcement command:
  - `STAGE4_CONTRACT.md` section `7.1) Boundary enforcement check`
- Cross-feature import rule passes:
  - no `src/features/<feature>` module imports another feature internals

Remaining (progressive shim cleanup):
- Potential shim-like callsites are still present (tracking-only output from script).
- These require progressive migration to command dispatch or verified feature-local APIs.
- Run:
  - `node scripts/check-feature-boundaries.mjs`
  - review the `Potential Stage 4 shim callsites` list

Notes:
- Step 9 enforcement criterion ("ban imports from other feature folders") is now implemented as a repeatable script check.
- The script exits non-zero only for cross-feature import violations.
