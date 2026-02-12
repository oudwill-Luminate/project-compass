

## Stakeholder Score Legends and Communication Plan Enhancements

### 1. Add Power and Interest Score Descriptions

Add tooltip descriptions to the Power and Interest column headers and to each score option in the dropdowns. This gives stakeholders context on what each score (1-5) means.

**Score definitions:**

Power:
- 1 -- Minimal: No authority over project decisions
- 2 -- Low: Can influence minor decisions
- 3 -- Moderate: Controls some resources or approvals
- 4 -- High: Key decision-maker or budget holder
- 5 -- Critical: Executive sponsor or veto power

Interest:
- 1 -- Minimal: Unaffected by project outcomes
- 2 -- Low: Peripherally aware
- 3 -- Moderate: Somewhat affected by results
- 4 -- High: Directly impacted by deliverables
- 5 -- Critical: Core dependency on project success

Each score in the `SelectItem` dropdown will show the number plus a short label (e.g., "3 - Moderate"). A small info icon with a `Tooltip` will be added next to the "Power" and "Interest" table headers explaining the scale.

### 2. Expand Communication Plan to a Dropdown

Replace the free-text `Input` for Communication Plan with a `Select` dropdown offering predefined strategies, plus an "Other" option that reveals a text input for custom plans.

**Predefined options:**
- Weekly Email Update
- Bi-Weekly Meeting
- Monthly Report
- Quarterly Review
- Ad-Hoc / As Needed
- Daily Standup
- Steering Committee
- Other (custom)

When "Other" is selected, a small text input will appear for custom entry.

---

### Technical Details

**File to modify:** `src/components/StakeholdersView.tsx`

**Changes:**
- Add `POWER_LABELS` and `INTEREST_LABELS` config objects mapping scores 1-5 to short descriptions
- Update the Power and Interest `Select` dropdowns to show labels alongside numbers (e.g., `"3 - Moderate"`)
- Add `Tooltip` on table headers with full scale explanation, importing from `@/components/ui/tooltip`
- Add `COMM_PLAN_OPTIONS` array with predefined communication strategies
- Replace the Comm. Plan `Input` with a `Select` dropdown; handle "Other" with a conditional text input
- Add a legend/key section below the Power/Interest Matrix explaining the quadrant strategies

