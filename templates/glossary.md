# Glossary

Domain terms and their definitions. All agents use consistent terminology.

| Term | Definition | In Code As |
|------|-----------|------------|
| [e.g., reading] | [e.g., A tarot card reading session] | `Reading` type |
| [e.g., spread] | [e.g., The layout pattern for cards] | `SpreadType` enum |
| [e.g., interpretation] | [e.g., AI-generated meaning of cards] | `Interpretation` type |
| | | |
| | | |

## User Roles
| Role | Permissions | In Code As |
|------|------------|------------|
| [e.g., free user] | [e.g., 3 readings per day] | `role: "free"` |
| [e.g., premium] | [e.g., unlimited readings + chat] | `role: "premium"` |
| [e.g., admin] | [e.g., all access + user management] | `role: "admin"` |

## Status Flows
```
[e.g., Order: draft → pending → paid → fulfilled → completed]
[e.g., User: anonymous → registered → verified → premium]
```

---
*Agents use this to write code with correct naming, understand business logic, and communicate clearly in docs.*
