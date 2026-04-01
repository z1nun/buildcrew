# ERD (Entity Relationship Diagram)

## Tables

### users
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| email | text | unique, not null | |
| created_at | timestamp | default now() | |

### [table_name]
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|

## Relationships

```
users 1──* orders      (one user has many orders)
orders *──1 products   (many orders reference one product)
```

## Indexes
- `users.email` — unique index for login lookup
- [add your indexes]

## RLS Policies (if using Supabase)
- `users`: users can only read/update their own row
- [add your policies]

---
*Agents use this to understand your data model when planning features, writing queries, and reviewing security.*
