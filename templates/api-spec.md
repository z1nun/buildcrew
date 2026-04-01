# API Specification

## Base URL
- **Development**: `http://localhost:3000/api`
- **Production**: `https://[your-domain]/api`

## Authentication
- **Method**: [Bearer token / Cookie / API key]
- **Header**: `Authorization: Bearer <token>`

## Endpoints

### [Resource Name]

#### `GET /api/[resource]`
- **Auth**: Required / Public
- **Description**: [what it does]
- **Query Params**: `?page=1&limit=20`
- **Response 200**:
```json
{
  "data": [],
  "total": 0
}
```
- **Response 401**: Unauthorized

#### `POST /api/[resource]`
- **Auth**: Required
- **Body**:
```json
{
  "field": "value"
}
```
- **Response 201**: Created
- **Response 400**: Validation error

## Error Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Rate Limits
- [e.g., "100 requests per minute per user"]
- [e.g., "AI endpoints: 10 requests per minute"]

---
*Agents use this to implement correct API calls, validate endpoints during review, and test during QA.*
