# User Flows

## Core Flows

### [Flow Name, e.g., "Purchase Flow"]
```
[Entry Point] → [Step 1] → [Step 2] → [Step 3] → [Success]
                    ↓           ↓           ↓
                [Error A]   [Error B]   [Error C]
```

**Happy Path**:
1. User [action]
2. System [response]
3. User [action]
4. System [response] → Success

**Error Paths**:
- Step 1 fails: [what happens, where user goes]
- Step 2 fails: [what happens]
- Network error: [retry? fallback?]

**Edge Cases**:
- [e.g., user refreshes mid-flow]
- [e.g., session expires during checkout]
- [e.g., concurrent access from two devices]

### [Next Flow...]

## Page Map
```
/                 → Home (landing)
/login            → Auth
/dashboard        → Main dashboard (auth required)
/dashboard/[id]   → Detail page
/settings         → User settings
```

---
*Agents use this to implement correct navigation, handle all error states, and test edge cases during QA.*
